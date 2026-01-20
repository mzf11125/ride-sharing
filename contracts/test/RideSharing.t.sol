// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {RideSharing} from "../src/RideSharing.sol";

contract RideSharingTest is Test {
    RideSharing public rideSharing;

    address public rider = makeAddr("rider");
    address public driver = makeAddr("driver");
    address public driver2 = makeAddr("driver2");
    address public stranger = makeAddr("stranger");

    uint256 public constant RIDE_AMOUNT = 1 ether;
    uint256 public constant ACCEPT_TIMEOUT = 15 minutes;
    uint256 public constant START_TIMEOUT = 30 minutes;

    function setUp() public {
        rideSharing = new RideSharing();
        vm.deal(rider, 10 ether);
        vm.deal(driver, 10 ether);
        vm.deal(driver2, 10 ether);
        vm.deal(stranger, 10 ether);

        // Register drivers
        vm.prank(driver);
        rideSharing.registerDriver("Driver One");
        vm.prank(driver2);
        rideSharing.registerDriver("Driver Two");
    }

    // ============ Driver Registry Tests ============

    function test_RegisterDriver() public {
        address newDriver = makeAddr("newDriver");
        vm.prank(newDriver);
        rideSharing.registerDriver("Alice");

        (bool isRegistered, uint256 avgRating, uint256 count) =
            rideSharing.getDriverRating(newDriver);

        assertTrue(isRegistered);
        assertEq(avgRating, 0);
        assertEq(count, 0);
    }

    function test_RevertRegisterDriver_AlreadyRegistered() public {
        vm.prank(driver);
        vm.expectRevert(RideSharing.DriverAlreadyRegistered.selector);
        rideSharing.registerDriver("Another Name");
    }

    function test_IsRegisteredDriver() public {
        assertTrue(rideSharing.isRegisteredDriver(driver));
        assertFalse(rideSharing.isRegisteredDriver(stranger));
    }

    function test_GetRegisteredDrivers() public {
        address[] memory drivers = rideSharing.getRegisteredDrivers();
        assertEq(drivers.length, 2);
        assertEq(drivers[0], driver);
        assertEq(drivers[1], driver2);
    }

    function test_RevertAcceptRide_NotRegistered() public {
        uint256 rideId = _createRide();

        address unregisteredDriver = makeAddr("unregistered");
        vm.prank(unregisteredDriver);
        vm.expectRevert(RideSharing.DriverNotRegistered.selector);
        rideSharing.acceptRide(rideId);
    }

    // ============ Request Ride Tests ============

    function test_RequestRide() public {
        vm.prank(rider);
        uint256 rideId = rideSharing.requestRide(
            "-6.200000", "106.816666", "Jakarta",
            "-6.914744", "107.609810", "Bandung",
            RIDE_AMOUNT
        );

        assertEq(rideId, 1);
        assertEq(rideSharing.rideCounter(), 1);

        RideSharing.Ride memory ride = rideSharing.getRide(rideId);
        assertEq(ride.rider, rider);
        assertEq(ride.amount, RIDE_AMOUNT);
        assertEq(uint256(ride.state), uint256(RideSharing.State.Requested));
    }

    // ============ Accept Ride Tests ============

    function test_AcceptRide() public {
        uint256 rideId = _createRide();

        vm.prank(driver);
        rideSharing.acceptRide(rideId);

        RideSharing.Ride memory ride = rideSharing.getRide(rideId);
        assertEq(ride.driver, driver);
        assertEq(uint256(ride.state), uint256(RideSharing.State.Accepted));
        assertTrue(ride.acceptedAt > 0);
    }

    function test_RevertAcceptRide_WrongState() public {
        uint256 rideId = _createRide();

        vm.prank(driver);
        rideSharing.acceptRide(rideId);

        // Try to accept again
        vm.prank(driver2);
        vm.expectRevert();
        rideSharing.acceptRide(rideId);
    }

    // ============ Fund Ride Tests ============

    function test_FundRide() public {
        uint256 rideId = _createAndAcceptRide();

        vm.prank(rider);
        rideSharing.fundRide{value: RIDE_AMOUNT}(rideId);

        RideSharing.Ride memory ride = rideSharing.getRide(rideId);
        assertEq(uint256(ride.state), uint256(RideSharing.State.Funded));
        assertEq(rideSharing.getContractBalance(), RIDE_AMOUNT);
        assertTrue(ride.fundedAt > 0);
    }

    function test_RevertFundRide_NotRider() public {
        uint256 rideId = _createAndAcceptRide();

        vm.prank(stranger);
        vm.expectRevert(RideSharing.NotRider.selector);
        rideSharing.fundRide{value: RIDE_AMOUNT}(rideId);
    }

    function test_RevertFundRide_InsufficientFunds() public {
        uint256 rideId = _createAndAcceptRide();

        vm.prank(rider);
        vm.expectRevert(RideSharing.InsufficientFunds.selector);
        rideSharing.fundRide{value: 0.5 ether}(rideId);
    }

    // ============ Start Ride Tests ============

    function test_StartRide() public {
        uint256 rideId = _createAcceptAndFundRide();

        vm.prank(driver);
        rideSharing.startRide(rideId);

        RideSharing.Ride memory ride = rideSharing.getRide(rideId);
        assertEq(uint256(ride.state), uint256(RideSharing.State.Started));
        assertTrue(ride.startedAt > 0);
    }

    function test_RevertStartRide_NotDriver() public {
        uint256 rideId = _createAcceptAndFundRide();

        vm.prank(rider);
        vm.expectRevert(RideSharing.NotDriver.selector);
        rideSharing.startRide(rideId);
    }

    // ============ Complete Ride Tests ============

    function test_CompleteRide() public {
        uint256 rideId = _createAndStartRide();

        vm.prank(driver);
        rideSharing.completeRide(rideId);

        RideSharing.Ride memory ride = rideSharing.getRide(rideId);
        assertEq(uint256(ride.state), uint256(RideSharing.State.CompletedByDriver));
    }

    // ============ Confirm Arrival (Finalize) Tests ============

    function test_ConfirmArrival() public {
        uint256 rideId = _createAndCompleteRide();

        uint256 driverBalanceBefore = driver.balance;

        vm.prank(rider);
        rideSharing.confirmArrival(rideId);

        RideSharing.Ride memory ride = rideSharing.getRide(rideId);
        assertEq(uint256(ride.state), uint256(RideSharing.State.Finalized));
        assertEq(driver.balance, driverBalanceBefore + RIDE_AMOUNT);
        assertEq(rideSharing.getContractBalance(), 0);
    }

    function test_RevertConfirmArrival_NotRider() public {
        uint256 rideId = _createAndCompleteRide();

        vm.prank(stranger);
        vm.expectRevert(RideSharing.NotRider.selector);
        rideSharing.confirmArrival(rideId);
    }

    // ============ Cancel Ride Tests ============

    function test_CancelRide_BeforeFunding() public {
        uint256 rideId = _createAndAcceptRide();

        vm.prank(rider);
        rideSharing.cancelRide(rideId, "Changed mind");

        RideSharing.Ride memory ride = rideSharing.getRide(rideId);
        assertEq(uint256(ride.state), uint256(RideSharing.State.Cancelled));
    }

    function test_CancelRide_AfterFunding_RefundsRider() public {
        uint256 rideId = _createAcceptAndFundRide();

        uint256 riderBalanceBefore = rider.balance;

        vm.prank(rider);
        rideSharing.cancelRide(rideId, "Driver delayed");

        RideSharing.Ride memory ride = rideSharing.getRide(rideId);
        assertEq(uint256(ride.state), uint256(RideSharing.State.Cancelled));
        assertEq(rider.balance, riderBalanceBefore + RIDE_AMOUNT);
    }

    function test_RevertCancelRide_AfterStarted() public {
        uint256 rideId = _createAndStartRide();

        vm.prank(rider);
        vm.expectRevert();
        rideSharing.cancelRide(rideId, "Too late");
    }

    function test_RevertCancelRide_NotParticipant() public {
        uint256 rideId = _createAndAcceptRide();

        vm.prank(stranger);
        vm.expectRevert(RideSharing.NotParticipant.selector);
        rideSharing.cancelRide(rideId, "Not my ride");
    }

    // ============ Timeout Refund Tests ============

    function test_ClaimRefundNotFunded_AfterTimeout() public {
        uint256 rideId = _createAndAcceptRide();

        // Warp past ACCEPT_TIMEOUT
        vm.warp(block.timestamp + ACCEPT_TIMEOUT + 1);

        vm.prank(rider);
        rideSharing.claimRefundNotFunded(rideId);

        RideSharing.Ride memory ride = rideSharing.getRide(rideId);
        assertEq(uint256(ride.state), uint256(RideSharing.State.Refunded));
    }

    function test_RevertClaimRefundNotFunded_BeforeTimeout() public {
        uint256 rideId = _createAndAcceptRide();

        vm.prank(rider);
        vm.expectRevert(
            abi.encodeWithSelector(RideSharing.TimeoutNotReached.selector, block.timestamp, block.timestamp + ACCEPT_TIMEOUT)
        );
        rideSharing.claimRefundNotFunded(rideId);
    }

    function test_ClaimRefundNotStarted_AfterTimeout() public {
        uint256 rideId = _createAcceptAndFundRide();

        uint256 riderBalanceBefore = rider.balance;

        // Warp past START_TIMEOUT
        vm.warp(block.timestamp + START_TIMEOUT + 1);

        vm.prank(rider);
        rideSharing.claimRefundNotStarted(rideId);

        RideSharing.Ride memory ride = rideSharing.getRide(rideId);
        assertEq(uint256(ride.state), uint256(RideSharing.State.Refunded));
        assertEq(rider.balance, riderBalanceBefore + RIDE_AMOUNT);
    }

    function test_RevertClaimRefundNotStarted_BeforeTimeout() public {
        uint256 rideId = _createAcceptAndFundRide();

        vm.prank(rider);
        vm.expectRevert(
            abi.encodeWithSelector(RideSharing.TimeoutNotReached.selector, block.timestamp, block.timestamp + START_TIMEOUT)
        );
        rideSharing.claimRefundNotStarted(rideId);
    }

    function test_GetRefundStatus() public {
        uint256 rideId = _createAcceptAndFundRide();

        (bool canRefund, uint256 refundType, uint256 timeRemaining) =
            rideSharing.getRefundStatus(rideId);

        assertFalse(canRefund);
        assertEq(refundType, 2); // Not started timeout
        assertEq(timeRemaining, START_TIMEOUT);

        // Warp past timeout
        vm.warp(block.timestamp + START_TIMEOUT + 1);

        (canRefund, refundType, timeRemaining) = rideSharing.getRefundStatus(rideId);

        assertTrue(canRefund);
        assertEq(refundType, 2);
        assertEq(timeRemaining, 0);
    }

    // ============ Rating Tests ============

    function test_RateDriver() public {
        uint256 rideId = _createAndFinalizeRide();

        vm.prank(rider);
        rideSharing.rateDriver(rideId, 5);

        (bool riderRatedDriver, bool driverRatedRider, uint8 riderRating, uint8 driverRating) =
            rideSharing.getRideRating(rideId);
        assertTrue(riderRatedDriver);
        assertFalse(driverRatedRider);
        assertEq(riderRating, 5);
        assertEq(driverRating, 0);

        (bool isRegistered, uint256 avgRating, uint256 count) =
            rideSharing.getDriverRating(driver);
        assertTrue(isRegistered);
        assertEq(avgRating, 50); // 5.0 * 10
        assertEq(count, 1);
    }

    function test_RateDriver_MultipleRatings() public {
        // Create and finalize two rides for the same driver
        uint256 rideId1 = _createAndFinalizeRide();
        uint256 rideId2 = _createAndFinalizeRide();

        vm.startPrank(rider);
        rideSharing.rateDriver(rideId1, 4);
        rideSharing.rateDriver(rideId2, 5);
        vm.stopPrank();

        (bool isRegistered, uint256 avgRating, uint256 count) =
            rideSharing.getDriverRating(driver);
        assertTrue(isRegistered);
        assertEq(avgRating, 45); // (4+5)/2 * 10 = 4.5 * 10 = 45
        assertEq(count, 2);
    }

    function test_RevertRateDriver_NotRider() public {
        uint256 rideId = _createAndFinalizeRide();

        vm.prank(stranger);
        vm.expectRevert(RideSharing.NotRider.selector);
        rideSharing.rateDriver(rideId, 5);
    }

    function test_RevertRateDriver_NotFinalized() public {
        uint256 rideId = _createAndCompleteRide();

        vm.prank(rider);
        vm.expectRevert(RideSharing.RideNotFinalized.selector);
        rideSharing.rateDriver(rideId, 5);
    }

    function test_RevertRateDriver_InvalidRating() public {
        uint256 rideId = _createAndFinalizeRide();

        vm.prank(rider);
        vm.expectRevert(abi.encodeWithSelector(RideSharing.InvalidRating.selector, uint256(0)));
        rideSharing.rateDriver(rideId, 0);
    }

    function test_RevertRateDriver_AlreadyRated() public {
        uint256 rideId = _createAndFinalizeRide();

        vm.prank(rider);
        rideSharing.rateDriver(rideId, 5);

        vm.prank(rider);
        vm.expectRevert(RideSharing.AlreadyRated.selector);
        rideSharing.rateDriver(rideId, 4);
    }

    function test_RateRider() public {
        uint256 rideId = _createAndFinalizeRide();

        vm.prank(driver);
        rideSharing.rateRider(rideId, 5);

        (bool riderRatedDriver, bool driverRatedRider, uint8 riderRating, uint8 driverRating) =
            rideSharing.getRideRating(rideId);
        assertFalse(riderRatedDriver);
        assertTrue(driverRatedRider);
        assertEq(driverRating, 5);
    }

    function test_RevertRateRider_NotDriver() public {
        uint256 rideId = _createAndFinalizeRide();

        vm.prank(stranger);
        vm.expectRevert(RideSharing.NotDriver.selector);
        rideSharing.rateRider(rideId, 5);
    }

    function test_GetRideRating() public {
        uint256 rideId = _createAndFinalizeRide();

        vm.prank(rider);
        rideSharing.rateDriver(rideId, 4);

        (bool riderRatedDriver, bool driverRatedRider, uint8 riderRating, uint8 driverRating) =
            rideSharing.getRideRating(rideId);

        assertTrue(riderRatedDriver);
        assertFalse(driverRatedRider);
        assertEq(riderRating, 4);
        assertEq(driverRating, 0);
    }

    // ============ View Functions Tests ============

    function test_GetRiderRides() public {
        vm.startPrank(rider);
        rideSharing.requestRide("-6.2", "106.8", "A", "-6.9", "107.6", "B", RIDE_AMOUNT);
        rideSharing.requestRide("-6.2", "106.8", "C", "-6.9", "107.6", "D", RIDE_AMOUNT);
        vm.stopPrank();

        uint256[] memory rides = rideSharing.getRiderRides(rider);
        assertEq(rides.length, 2);
        assertEq(rides[0], 1);
        assertEq(rides[1], 2);
    }

    function test_GetDriverRides() public {
        uint256 rideId1 = _createRide();
        uint256 rideId2 = _createRide();

        vm.startPrank(driver);
        rideSharing.acceptRide(rideId1);
        rideSharing.acceptRide(rideId2);
        vm.stopPrank();

        uint256[] memory rides = rideSharing.getDriverRides(driver);
        assertEq(rides.length, 2);
    }

    // ============ Full Flow Test ============

    function test_FullRideFlow_WithRatings() public {
        // Rider requests
        vm.prank(rider);
        uint256 rideId = rideSharing.requestRide(
            "-6.200000", "106.816666", "Jakarta",
            "-6.914744", "107.609810", "Bandung",
            RIDE_AMOUNT
        );

        // Driver accepts
        vm.prank(driver);
        rideSharing.acceptRide(rideId);

        // Rider funds
        vm.prank(rider);
        rideSharing.fundRide{value: RIDE_AMOUNT}(rideId);

        // Driver starts
        vm.prank(driver);
        rideSharing.startRide(rideId);

        // Driver completes
        vm.prank(driver);
        rideSharing.completeRide(rideId);

        // Rider confirms arrival
        uint256 driverBalanceBefore = driver.balance;
        vm.prank(rider);
        rideSharing.confirmArrival(rideId);

        // Verify payment
        assertEq(driver.balance, driverBalanceBefore + RIDE_AMOUNT);

        // Rate each other
        vm.prank(rider);
        rideSharing.rateDriver(rideId, 5);

        vm.prank(driver);
        rideSharing.rateRider(rideId, 4);

        // Verify final state
        RideSharing.Ride memory ride = rideSharing.getRide(rideId);
        assertEq(uint256(ride.state), uint256(RideSharing.State.Finalized));

        // Verify ratings
        (bool riderRatedDriver, bool driverRatedRider, uint8 riderRating, uint8 driverRating) =
            rideSharing.getRideRating(rideId);
        assertTrue(riderRatedDriver);
        assertTrue(driverRatedRider);
        assertEq(riderRating, 5);
        assertEq(driverRating, 4);
    }

    // ============ Helper Functions ============

    function _createRide() internal returns (uint256) {
        vm.prank(rider);
        return rideSharing.requestRide(
            "-6.200000", "106.816666", "Jakarta",
            "-6.914744", "107.609810", "Bandung",
            RIDE_AMOUNT
        );
    }

    function _createAndAcceptRide() internal returns (uint256) {
        uint256 rideId = _createRide();
        vm.prank(driver);
        rideSharing.acceptRide(rideId);
        return rideId;
    }

    function _createAcceptAndFundRide() internal returns (uint256) {
        uint256 rideId = _createAndAcceptRide();
        vm.prank(rider);
        rideSharing.fundRide{value: RIDE_AMOUNT}(rideId);
        return rideId;
    }

    function _createAndStartRide() internal returns (uint256) {
        uint256 rideId = _createAcceptAndFundRide();
        vm.prank(driver);
        rideSharing.startRide(rideId);
        return rideId;
    }

    function _createAndCompleteRide() internal returns (uint256) {
        uint256 rideId = _createAndStartRide();
        vm.prank(driver);
        rideSharing.completeRide(rideId);
        return rideId;
    }

    function _createAndFinalizeRide() internal returns (uint256) {
        uint256 rideId = _createAndCompleteRide();
        vm.prank(rider);
        rideSharing.confirmArrival(rideId);
        return rideId;
    }
}

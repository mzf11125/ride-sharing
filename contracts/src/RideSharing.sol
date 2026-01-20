// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title RideSharing
 * @notice Decentralized ride-sharing contract with escrow, ratings, and timeout functionality
 * @dev Implements state machine for ride lifecycle, secure fund handling, and reputation system
 */
contract RideSharing {
    // ============ Constants ============
    uint256 public constant ACCEPT_TIMEOUT = 15 minutes;
    uint256 public constant START_TIMEOUT = 30 minutes;
    uint256 public constant MIN_RATING = 1;
    uint256 public constant MAX_RATING = 5;

    // ============ Enums ============
    enum State {
        Requested,        // Rider has requested a ride
        Accepted,         // Driver has accepted the ride
        Funded,           // Rider has deposited funds into escrow
        Started,          // Ride has begun
        CompletedByDriver, // Driver marks ride as complete
        Finalized,        // Rider confirms and funds released
        Cancelled,        // Ride was cancelled
        Refunded          // Ride was refunded due to timeout
    }

    // ============ Structs ============
    struct Location {
        string latitude;
        string longitude;
        string address_;
    }

    struct Ride {
        uint256 id;
        address payable rider;
        address payable driver;
        uint256 amount;
        State state;
        Location pickup;
        Location destination;
        uint256 requestedAt;
        uint256 acceptedAt;
        uint256 fundedAt;
        uint256 startedAt;
        uint256 completedAt;
        uint256 finalizedAt;
    }

    struct Driver {
        bool isRegistered;
        uint256 totalRating;
        uint256 ratingCount;
        uint256[] rideIds;
    }

    struct Rating {
        bool riderRatedDriver;
        bool driverRatedRider;
        uint8 riderRating;      // 1-5 stars
        uint8 driverRating;     // 1-5 stars
    }

    // ============ State Variables ============
    uint256 public rideCounter;
    mapping(uint256 => Ride) public rides;
    mapping(address => uint256[]) public riderRides;
    mapping(address => uint256[]) public driverRides;

    // Driver Registry
    mapping(address => Driver) public drivers;
    address[] public driverAddresses;

    // Ratings (rideId => Rating)
    mapping(uint256 => Rating) public ratings;

    // ============ Events ============
    event DriverRegistered(address indexed driver, string name);
    event RideRequested(uint256 indexed rideId, address indexed rider, uint256 amount);
    event RideAccepted(uint256 indexed rideId, address indexed driver, uint256 acceptedAt);
    event RideFunded(uint256 indexed rideId, uint256 amount, uint256 fundedAt);
    event RideStarted(uint256 indexed rideId, uint256 timestamp);
    event RideCompletedByDriver(uint256 indexed rideId, uint256 timestamp);
    event RideFinalized(uint256 indexed rideId, uint256 amount);
    event RideCancelled(uint256 indexed rideId, address indexed cancelledBy, string reason);
    event RideRefunded(uint256 indexed rideId, address indexed rider, uint256 amount, string reason);
    event DriverRated(uint256 indexed rideId, address indexed driver, uint8 rating, uint256 newAverage);
    event RiderRated(uint256 indexed rideId, address indexed rider, uint8 rating, uint256 newAverage);

    // ============ Errors ============
    error InvalidState(State current, State expected);
    error NotRider();
    error NotDriver();
    error NotParticipant();
    error InsufficientFunds();
    error TransferFailed();
    error RideNotFound();
    error DriverNotRegistered();
    error DriverAlreadyRegistered();
    error InvalidRating(uint256 rating);
    error AlreadyRated();
    error RideNotFinalized();
    error TimeoutNotReached(uint256 currentTime, uint256 timeoutTime);
    error NoRefundAvailable();
    error OnlyRegisteredDriver();

    // ============ Modifiers ============
    modifier onlyRider(uint256 _rideId) {
        if (rides[_rideId].rider != msg.sender) revert NotRider();
        _;
    }

    modifier onlyDriver(uint256 _rideId) {
        if (rides[_rideId].driver != msg.sender) revert NotDriver();
        _;
    }

    modifier inState(uint256 _rideId, State _state) {
        if (rides[_rideId].state != _state) {
            revert InvalidState(rides[_rideId].state, _state);
        }
        _;
    }

    modifier rideExists(uint256 _rideId) {
        if (_rideId == 0 || _rideId > rideCounter) revert RideNotFound();
        _;
    }

    modifier onlyRegisteredDriver() {
        if (!drivers[msg.sender].isRegistered) revert DriverNotRegistered();
        _;
    }

    // ============ Driver Registry Functions ============

    /**
     * @notice Register as a driver
     * @param _name Driver's display name
     */
    function registerDriver(string calldata _name) external {
        if (drivers[msg.sender].isRegistered) revert DriverAlreadyRegistered();

        drivers[msg.sender].isRegistered = true;
        drivers[msg.sender].totalRating = 0;
        drivers[msg.sender].ratingCount = 0;
        driverAddresses.push(msg.sender);

        emit DriverRegistered(msg.sender, _name);
    }

    /**
     * @notice Check if an address is a registered driver
     * @param _driver Address to check
     */
    function isRegisteredDriver(address _driver) external view returns (bool) {
        return drivers[_driver].isRegistered;
    }

    /**
     * @notice Get driver's rating information
     * @param _driver Driver address
     * @return isRegistered Whether the driver is registered
     * @return averageRating Average rating (scaled by 10 for precision, e.g., 45 = 4.5 stars)
     * @return ratingCount Total number of ratings
     */
    function getDriverRating(address _driver)
        external
        view
        returns (bool isRegistered, uint256 averageRating, uint256 ratingCount)
    {
        Driver memory driver = drivers[_driver];
        isRegistered = driver.isRegistered;
        ratingCount = driver.ratingCount;
        if (driver.ratingCount > 0) {
            averageRating = (driver.totalRating * 10) / driver.ratingCount;
        }
    }

    /**
     * @notice Get all registered driver addresses
     */
    function getRegisteredDrivers() external view returns (address[] memory) {
        return driverAddresses;
    }

    // ============ Ride Lifecycle Functions ============

    /**
     * @notice Request a new ride
     * @param _pickupLat Pickup latitude
     * @param _pickupLng Pickup longitude
     * @param _pickupAddr Pickup address
     * @param _destLat Destination latitude
     * @param _destLng Destination longitude
     * @param _destAddr Destination address
     * @param _amount Ride fare in wei
     * @return rideId The ID of the newly created ride
     */
    function requestRide(
        string calldata _pickupLat,
        string calldata _pickupLng,
        string calldata _pickupAddr,
        string calldata _destLat,
        string calldata _destLng,
        string calldata _destAddr,
        uint256 _amount
    ) external returns (uint256 rideId) {
        rideCounter++;
        rideId = rideCounter;

        Ride storage ride = rides[rideId];
        ride.id = rideId;
        ride.rider = payable(msg.sender);
        ride.amount = _amount;
        ride.state = State.Requested;
        ride.pickup = Location(_pickupLat, _pickupLng, _pickupAddr);
        ride.destination = Location(_destLat, _destLng, _destAddr);
        ride.requestedAt = block.timestamp;

        riderRides[msg.sender].push(rideId);

        emit RideRequested(rideId, msg.sender, _amount);
    }

    /**
     * @notice Driver accepts a ride request (must be registered)
     * @param _rideId The ride ID to accept
     */
    function acceptRide(uint256 _rideId)
        external
        rideExists(_rideId)
        inState(_rideId, State.Requested)
        onlyRegisteredDriver
    {
        Ride storage ride = rides[_rideId];
        ride.driver = payable(msg.sender);
        ride.state = State.Accepted;
        ride.acceptedAt = block.timestamp;

        drivers[msg.sender].rideIds.push(_rideId);
        driverRides[msg.sender].push(_rideId);

        emit RideAccepted(_rideId, msg.sender, block.timestamp);
    }

    /**
     * @notice Rider deposits funds into escrow
     * @param _rideId The ride ID to fund
     */
    function fundRide(uint256 _rideId)
        external
        payable
        rideExists(_rideId)
        onlyRider(_rideId)
        inState(_rideId, State.Accepted)
    {
        Ride storage ride = rides[_rideId];
        if (msg.value < ride.amount) revert InsufficientFunds();

        ride.state = State.Funded;
        ride.fundedAt = block.timestamp;

        emit RideFunded(_rideId, msg.value, block.timestamp);
    }

    /**
     * @notice Driver starts the ride
     * @param _rideId The ride ID to start
     */
    function startRide(uint256 _rideId)
        external
        rideExists(_rideId)
        onlyDriver(_rideId)
        inState(_rideId, State.Funded)
    {
        Ride storage ride = rides[_rideId];
        ride.state = State.Started;
        ride.startedAt = block.timestamp;

        emit RideStarted(_rideId, block.timestamp);
    }

    /**
     * @notice Driver marks ride as completed
     * @param _rideId The ride ID to complete
     */
    function completeRide(uint256 _rideId)
        external
        rideExists(_rideId)
        onlyDriver(_rideId)
        inState(_rideId, State.Started)
    {
        Ride storage ride = rides[_rideId];
        ride.state = State.CompletedByDriver;
        ride.completedAt = block.timestamp;

        emit RideCompletedByDriver(_rideId, block.timestamp);
    }

    /**
     * @notice Rider confirms completion (confirm arrival) and releases funds to driver
     * @param _rideId The ride ID to finalize
     */
    function confirmArrival(uint256 _rideId)
        external
        rideExists(_rideId)
        onlyRider(_rideId)
        inState(_rideId, State.CompletedByDriver)
    {
        Ride storage ride = rides[_rideId];
        ride.state = State.Finalized;
        ride.finalizedAt = block.timestamp;

        uint256 amount = ride.amount;

        (bool success, ) = ride.driver.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit RideFinalized(_rideId, amount);
    }

    /**
     * @notice Cancel a ride (only before Started state)
     * @param _rideId The ride ID to cancel
     * @param _reason Reason for cancellation
     */
    function cancelRide(uint256 _rideId, string calldata _reason) external rideExists(_rideId) {
        Ride storage ride = rides[_rideId];

        // Only rider or driver can cancel
        if (msg.sender != ride.rider && msg.sender != ride.driver) {
            revert NotParticipant();
        }

        // Can only cancel before ride starts
        State currentState = ride.state;
        if (currentState == State.Started ||
            currentState == State.CompletedByDriver ||
            currentState == State.Finalized ||
            currentState == State.Cancelled ||
            currentState == State.Refunded) {
            revert InvalidState(currentState, State.Requested);
        }

        // Refund if funded
        if (currentState == State.Funded) {
            uint256 amount = ride.amount;
            ride.state = State.Cancelled;

            (bool success, ) = ride.rider.call{value: amount}("");
            if (!success) revert TransferFailed();
        } else {
            ride.state = State.Cancelled;
        }

        emit RideCancelled(_rideId, msg.sender, _reason);
    }

    // ============ Timeout Refund Functions ============

    /**
     * @notice Claim refund if ride was accepted but not funded within timeout
     * @param _rideId The ride ID to claim refund for
     */
    function claimRefundNotFunded(uint256 _rideId) external rideExists(_rideId) {
        Ride storage ride = rides[_rideId];

        if (msg.sender != ride.rider) revert NotRider();
        if (ride.state != State.Accepted) revert NoRefundAvailable();

        uint256 timeElapsed = block.timestamp - ride.acceptedAt;
        if (timeElapsed < ACCEPT_TIMEOUT) {
            revert TimeoutNotReached(block.timestamp, ride.acceptedAt + ACCEPT_TIMEOUT);
        }

        ride.state = State.Refunded;

        // No funds to refund since ride was never funded

        emit RideRefunded(_rideId, ride.rider, 0, "Accept timeout");
    }

    /**
     * @notice Claim refund if ride was funded but not started within timeout
     * @param _rideId The ride ID to claim refund for
     */
    function claimRefundNotStarted(uint256 _rideId) external rideExists(_rideId) {
        Ride storage ride = rides[_rideId];

        if (msg.sender != ride.rider) revert NotRider();
        if (ride.state != State.Funded) revert NoRefundAvailable();

        uint256 timeElapsed = block.timestamp - ride.fundedAt;
        if (timeElapsed < START_TIMEOUT) {
            revert TimeoutNotReached(block.timestamp, ride.fundedAt + START_TIMEOUT);
        }

        uint256 amount = ride.amount;
        ride.state = State.Refunded;

        (bool success, ) = ride.rider.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit RideRefunded(_rideId, ride.rider, amount, "Start timeout");
    }

    // ============ Rating Functions ============

    /**
     * @notice Rate the driver (only after finalized)
     * @param _rideId The ride ID
     * @param _rating Rating from 1-5
     */
    function rateDriver(uint256 _rideId, uint8 _rating) external rideExists(_rideId) {
        Ride storage ride = rides[_rideId];

        if (msg.sender != ride.rider) revert NotRider();
        if (ride.state != State.Finalized) revert RideNotFinalized();
        if (_rating < MIN_RATING || _rating > MAX_RATING) revert InvalidRating(_rating);
        if (ratings[_rideId].riderRatedDriver) revert AlreadyRated();

        ratings[_rideId].riderRatedDriver = true;
        ratings[_rideId].riderRating = _rating;

        address driverAddr = ride.driver;
        drivers[driverAddr].totalRating += _rating;
        drivers[driverAddr].ratingCount++;

        uint256 newAverage = (drivers[driverAddr].totalRating * 10) / drivers[driverAddr].ratingCount;

        emit DriverRated(_rideId, driverAddr, _rating, newAverage);
    }

    /**
     * @notice Rate the rider (only after finalized)
     * @param _rideId The ride ID
     * @param _rating Rating from 1-5
     */
    function rateRider(uint256 _rideId, uint8 _rating) external rideExists(_rideId) {
        Ride storage ride = rides[_rideId];

        if (msg.sender != ride.driver) revert NotDriver();
        if (ride.state != State.Finalized) revert RideNotFinalized();
        if (_rating < MIN_RATING || _rating > MAX_RATING) revert InvalidRating(_rating);
        if (ratings[_rideId].driverRatedRider) revert AlreadyRated();

        ratings[_rideId].driverRatedRider = true;
        ratings[_rideId].driverRating = _rating;

        emit RiderRated(_rideId, ride.rider, _rating, 0);
    }

    /**
     * @notice Get rating for a specific ride
     * @param _rideId The ride ID
     */
    function getRideRating(uint256 _rideId)
        external
        view
        rideExists(_rideId)
        returns (
            bool riderRatedDriver,
            bool driverRatedRider,
            uint8 riderRating,
            uint8 driverRating
        )
    {
        Rating memory rating = ratings[_rideId];
        riderRatedDriver = rating.riderRatedDriver;
        driverRatedRider = rating.driverRatedRider;
        riderRating = rating.riderRating;
        driverRating = rating.driverRating;
    }

    // ============ View Functions ============

    /**
     * @notice Get ride details
     * @param _rideId The ride ID
     */
    function getRide(uint256 _rideId) external view rideExists(_rideId) returns (Ride memory) {
        return rides[_rideId];
    }

    /**
     * @notice Get all ride IDs for a rider
     * @param _rider The rider address
     */
    function getRiderRides(address _rider) external view returns (uint256[] memory) {
        return riderRides[_rider];
    }

    /**
     * @notice Get all ride IDs for a driver
     * @param _driver The driver address
     */
    function getDriverRides(address _driver) external view returns (uint256[] memory) {
        return driverRides[_driver];
    }

    /**
     * @notice Check if a refund is available for a ride
     * @param _rideId The ride ID
     * @return canRefund Whether refund is available
     * @return refundType Type of refund (0 = none, 1 = not funded timeout, 2 = not started timeout)
     * @return timeRemaining Time until refund becomes available (0 if already available)
     */
    function getRefundStatus(uint256 _rideId)
        external
        view
        rideExists(_rideId)
        returns (bool canRefund, uint256 refundType, uint256 timeRemaining)
    {
        Ride storage ride = rides[_rideId];

        if (ride.state == State.Accepted) {
            uint256 elapsed = block.timestamp - ride.acceptedAt;
            if (elapsed >= ACCEPT_TIMEOUT) {
                canRefund = true;
                refundType = 1;
                timeRemaining = 0;
            } else {
                canRefund = false;
                refundType = 1;
                timeRemaining = ACCEPT_TIMEOUT - elapsed;
            }
        } else if (ride.state == State.Funded) {
            uint256 elapsed = block.timestamp - ride.fundedAt;
            if (elapsed >= START_TIMEOUT) {
                canRefund = true;
                refundType = 2;
                timeRemaining = 0;
            } else {
                canRefund = false;
                refundType = 2;
                timeRemaining = START_TIMEOUT - elapsed;
            }
        }
    }

    /**
     * @notice Get contract balance (escrowed funds)
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}

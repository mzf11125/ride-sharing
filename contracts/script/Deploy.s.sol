// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {RideSharing} from "../src/RideSharing.sol";

contract DeployScript is Script {
    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        RideSharing rideSharing = new RideSharing();
        console.log("RideSharing deployed at:", address(rideSharing));
        
        vm.stopBroadcast();
    }
}

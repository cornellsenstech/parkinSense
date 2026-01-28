import React from "react";
import { View, Text } from "react-native";

export default function SensorStatus({isConnected,batteryPct}){
    const statusText = isConnected ? "Connected" : "Not Connected";
    const isReady = isConnected && batteryPct >= 20;
    const subText = isConnected
    ? `Battery: ${batteryPct ?? "--"}% • ${isReady ? "Ready" : "Battery low — please charge"}`
    : "Make sure your sensor is nearby";
    return (
        <View className = "bg-gray-100 rounded-xl p-4 mb-6">
            <View className = "flex-row">
                <View className = {`w-2 h-2 rounded-full ${isConnected? isReady? "bg-green-500" : "bg-orange-500" : "bg-red-500"} mr-2 mt-3`}></View>
                <Text className="text-lg font-bold">{statusText}</Text>
            </View>
            <Text className="mt-1 text-sm text-gray-600">{subText}</Text>
        </View>
    );
}
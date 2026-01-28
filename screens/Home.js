import Slider from "@react-native-community/slider";
import { useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import SensorStatus from "../components/SensorStatusCard";

export default function Home() {
  const [stiffness, setStiffness] = useState(0);
  const [tremor, setTremor] = useState(0);
  // variables for sensor status
  const [isConnected, setIsConnected] = useState(false);
  const [batteryPct, setBatteryPct] = useState(49);
  return (
    <ScrollView className="flex-1 bg-white p-10">
      <Text className="text-4xl text-left font-semibold">Good Afternoon</Text>
      <Text className="text-4xl text-left font-black mb-7">Kermit!</Text>
hhh
      <SensorStatus isConnected={true} batteryPct={10}/>

      <View className="bg-gray-100 rounded-xl p-4 mb-6">
        <Text className="text-xl pt-2">Current Levels</Text>

        <View className="flex-row items-end mt-4">
          <Text className="text-5xl font-semibold">2.8</Text>
          <Text className="text-2xl text-gray-500 ml-2 mb-1">ng/mL</Text>
        </View>

        <View className="self-start flex-row items-center rounded-full bg-green-200 px-4 py-2 mt-3">
          <View className="w-2 h-2 rounded-full bg-green-400 mr-2" />
          <Text className="text-sm font-medium">In range</Text>
        </View>

        <Text className="text-sm text-gray-500 mt-3">
          Updated 4 minutes ago
        </Text>
      </View>

      <View className="flex-1 bg-white mb-5">
        <Text className="text-2xl font-semibold mb-2">
          How are you feeling?
        </Text>

        <Text className="text-sm text-gray-500 mb-6">0 = none, 4 = severe</Text>

        <View className="bg-gray-100 rounded-2xl p-3">
          <Text className="text-base font-medium mb-1">Stiffness</Text>

          <Slider
            minimumValue={0}
            maximumValue={4}
            step={1}
            value={stiffness}
            onValueChange={setStiffness}
            minimumTrackTintColor="#86efac"
            maximumTrackTintColor="#e5e7eb"
            thumbTintColor="#86efac"
          />

          <Text className="text-sm text-gray-500 mt-2">{stiffness}/4</Text>

          <Text className="text-base font-medium mb-2">Tremor</Text>

          <Slider
            minimumValue={0}
            maximumValue={4}
            step={1}
            value={tremor}
            onValueChange={setTremor}
            minimumTrackTintColor="#86efac"
            maximumTrackTintColor="#e5e7eb"
            thumbTintColor="#86efac"
          />

          <Text className="text-sm text-gray-500 mt-1">{tremor}/4</Text>
        </View>

       

        <Pressable
          onPress={() => console.log("Saved stiffness:", stiffness)}
          className="bg-black rounded-xl py-3 mt-6 items-center"
        >
          <Text className="text-white font-semibold">Save</Text>
        </Pressable>
      </View>
      <Text className="text-2xl font-semibold mb-2">
          Today&apos;s Trend
        </Text>
        <Image source={require("../images/output.png")} style={{ width: 300, height: 150 }}/>


    </ScrollView>
  );
}

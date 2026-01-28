import { View, Text, Image} from "react-native";

export default function Profile() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Image source = {require("../images/kermit.png")} style = {{width: 200, height:200}}/>
      <Text>Profile</Text>
    </View>
  );
}
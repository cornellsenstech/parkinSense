import { Text, View } from "react-native";

// Leaflet is a DOM library, so it cannot run on iOS or Android. Metro picks
// this file on native and EventMap.web.js on web, via the platform extension
// in the filename — no conditionals needed at the call site.
//
// To add a real native map later, drop react-native-maps in here; the props
// (center, items, onSelect) are already the shape it needs.
export default function EventMap() {
  return (
    <View
      className="bg-gray-100 border border-gray-200 rounded-3xl items-center justify-center"
      style={{ height: 160 }}
    >
      <Text className="text-base text-gray-600 text-center px-6">
        The map is available in the web app. The full list is below.
      </Text>
    </View>
  );
}

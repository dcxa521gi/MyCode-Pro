import { Image, StyleSheet, View } from "react-native";

import { MYCODE_MARK } from "@/ui/brand";

/**
 * The MyCode mark is rendered with a faint light edge and shadow.
 */
export function CarvedMark({ size }: { size: number }) {
  const box = { width: size, height: size };
  return (
    <View style={box} accessibilityIgnoresInvertColors>
      {/* The lower lip of the cut catches the light, just below the mark. */}
      <Image
        source={MYCODE_MARK}
        tintColor="#ffffff"
        style={[StyleSheet.absoluteFill, styles.rim]}
      />
      <Image
        source={MYCODE_MARK}
        tintColor="#000000"
        style={[StyleSheet.absoluteFill, styles.floor]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rim: {
    opacity: 0.18,
    transform: [{ translateY: 1.5 }],
  },
  floor: {
    opacity: 0.45,
  },
});

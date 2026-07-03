import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";

import { colors, fonts, radii, spacing, typography } from "@/constants/theme";

interface SearchInputProps extends TextInputProps {
  containerStyle?: StyleProp<ViewStyle>;
}

const noInputOutline = { outlineStyle: "none" } as unknown as TextInputProps["style"];

export function SearchInput({ containerStyle, style, ...inputProps }: SearchInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.searchBox, focused && styles.inputFocused, containerStyle]}>
      <Ionicons name="search-outline" size={18} color={colors.muted} />
      <TextInput
        {...inputProps}
        onBlur={(event) => {
          setFocused(false);
          inputProps.onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          inputProps.onFocus?.(event);
        }}
        placeholderTextColor={colors.muted}
        selectionColor={colors.primary}
        underlineColorAndroid="transparent"
        style={[styles.searchInput, noInputOutline, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.medium,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    paddingHorizontal: 14,
  },
  inputFocused: {
    borderColor: colors.primary,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    paddingVertical: 12,
  },
});

import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { colors, fonts, typography } from "@/constants/theme";

interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string;
  password?: boolean;
}

export function FormField({ label, error, password, ...inputProps }: FormFieldProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, focused && styles.inputFocused, error ? styles.inputError : null]}>
        <TextInput
          {...inputProps}
          autoCapitalize={inputProps.autoCapitalize ?? "none"}
          numberOfLines={1}
          onBlur={(event) => {
            setFocused(false);
            inputProps.onBlur?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            inputProps.onFocus?.(event);
          }}
          placeholderTextColor={colors.muted}
          secureTextEntry={password && !isPasswordVisible}
          selectionColor={colors.primary}
          underlineColorAndroid="transparent"
          style={[styles.input, inputProps.style]}
        />
        {password ? (
          <Pressable
            accessibilityLabel={isPasswordVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            hitSlop={8}
            style={styles.toggleButton}
            onPress={() => setIsPasswordVisible((visible) => !visible)}
          >
            <Ionicons name={isPasswordVisible ? "eye-off-outline" : "eye-outline"} size={20} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 16 },
  label: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: typography.body,
    marginBottom: 7,
  },
  inputRow: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    paddingHorizontal: 14,
  },
  inputError: { borderColor: colors.danger },
  inputFocused: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 2,
  },
  input: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    outlineStyle: "none",
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    paddingVertical: 12,
  },
  toggleButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
});

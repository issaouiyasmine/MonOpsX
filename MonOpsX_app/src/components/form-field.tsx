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

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, error ? styles.inputError : null]}>
        <TextInput
          {...inputProps}
          autoCapitalize={inputProps.autoCapitalize ?? "none"}
          placeholderTextColor={colors.muted}
          secureTextEntry={password && !isPasswordVisible}
          selectionColor={colors.primary}
          style={styles.input}
        />
        {password ? (
          <Pressable
            accessibilityLabel={isPasswordVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            hitSlop={8}
            onPress={() => setIsPasswordVisible((visible) => !visible)}
          >
            <Text style={styles.toggle}>{isPasswordVisible ? "Masquer" : "Afficher"}</Text>
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
  input: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    paddingVertical: 12,
  },
  toggle: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
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

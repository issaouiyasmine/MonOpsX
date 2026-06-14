import { useState } from "react";
import { Link, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AuthShell } from "@/components/auth-shell";
import { FormField } from "@/components/form-field";
import { PrimaryButton } from "@/components/primary-button";
import { colors, fonts, typography } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import { getApiErrorMessage } from "@/utils/api-error";
import { isValidEmail } from "@/utils/validation";

interface LoginErrors {
  email?: string;
  password?: string;
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<LoginErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const { showToast } = useToast();

  async function handleSubmit() {
    const nextErrors: LoginErrors = {};
    if (!email.trim()) nextErrors.email = "L'adresse e-mail est obligatoire.";
    else if (!isValidEmail(email)) nextErrors.email = "Saisissez une adresse e-mail valide.";
    if (!password) nextErrors.password = "Le mot de passe est obligatoire.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      showToast("Connexion réussie.", "success");
      router.replace("/(main)/home");
    } catch (error) {
      showToast(getApiErrorMessage(error), "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Connexion"
      subtitle="Accédez à votre espace de supervision MonOpsX."
    >
      <FormField
        autoComplete="email"
        error={errors.email}
        keyboardType="email-address"
        label="Adresse e-mail"
        onChangeText={(value) => { setEmail(value); setErrors((current) => ({ ...current, email: undefined })); }}
        placeholder="nom@entreprise.com"
        returnKeyType="next"
        value={email}
      />
      <FormField
        autoComplete="current-password"
        error={errors.password}
        label="Mot de passe"
        onChangeText={(value) => { setPassword(value); setErrors((current) => ({ ...current, password: undefined })); }}
        onSubmitEditing={handleSubmit}
        password
        placeholder="Votre mot de passe"
        returnKeyType="done"
        value={password}
      />
      <PrimaryButton label="Se connecter" loading={isSubmitting} onPress={handleSubmit} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>{"Vous n'avez pas encore de compte ?"}</Text>
        <Link href="/(auth)/add-account" asChild>
          <Pressable hitSlop={8}>
            <Text style={styles.link}>Créer un compte</Text>
          </Pressable>
        </Link>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 5,
    marginTop: 22,
  },
  footerText: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
  },
  link: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: typography.body,
  },
});

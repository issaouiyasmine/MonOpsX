import { useState } from "react";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AuthShell } from "@/components/auth-shell";
import { FormField } from "@/components/form-field";
import { PrimaryButton } from "@/components/primary-button";
import { colors, fonts, typography } from "@/constants/theme";
import { useToast } from "@/providers/toast-provider";
import { isValidEmail } from "@/utils/validation";

export default function ForgotPassword() {
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  function submit() {
    if (!email.trim() || !isValidEmail(email)) {
      setError("Saisissez une adresse e-mail valide.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      showToast("Demande enregistrée. Contactez un administrateur pour réinitialiser le mot de passe.", "success");
    }, 300);
  }

  return (
    <AuthShell title="Mot de passe oublié" subtitle="Indiquez votre e-mail pour préparer une demande de réinitialisation.">
      <FormField
        autoComplete="email"
        error={error}
        keyboardType="email-address"
        label="Adresse e-mail"
        onChangeText={(value) => {
          setEmail(value);
          setError(undefined);
        }}
        placeholder="nom@entreprise.com"
        value={email}
      />
      <PrimaryButton label="Envoyer la demande" loading={loading} onPress={submit} />
      <View style={styles.footer}>
        <Link href="/(auth)/login" asChild>
          <Pressable hitSlop={8}>
            <Text style={styles.link}>Retour à la connexion</Text>
          </Pressable>
        </Link>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  footer: {
    alignItems: "center",
    marginTop: 22,
  },
  link: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: typography.body,
  },
});

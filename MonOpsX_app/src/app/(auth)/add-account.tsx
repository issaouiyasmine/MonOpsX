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
import { getPasswordError, isValidEmail, PASSWORD_RULES } from "@/utils/validation";

interface RegisterForm {
  accountName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmation: string;
}

type RegisterErrors = Partial<Record<keyof RegisterForm, string>>;

const initialForm: RegisterForm = {
  accountName: "",
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmation: "",
};

export default function AddAccount() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuth();
  const { showToast } = useToast();

  function updateField(field: keyof RegisterForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validate(): RegisterErrors {
    const nextErrors: RegisterErrors = {};
    if (!form.accountName.trim()) nextErrors.accountName = "Le nom du compte est obligatoire.";
    else if (form.accountName.trim().length < 3) nextErrors.accountName = "Le nom du compte doit contenir au moins 3 caractères.";
    if (!form.firstName.trim()) nextErrors.firstName = "Le prénom est obligatoire.";
    if (!form.lastName.trim()) nextErrors.lastName = "Le nom est obligatoire.";
    if (!form.email.trim()) nextErrors.email = "L'adresse e-mail est obligatoire.";
    else if (!isValidEmail(form.email)) nextErrors.email = "Saisissez une adresse e-mail valide.";
    if (!form.password) nextErrors.password = "Le mot de passe est obligatoire.";
    else {
      const passwordError = getPasswordError(form.password);
      if (passwordError) nextErrors.password = passwordError;
    }
    if (!form.confirmation) nextErrors.confirmation = "La confirmation est obligatoire.";
    else if (form.confirmation !== form.password) nextErrors.confirmation = "Les mots de passe ne correspondent pas.";
    return nextErrors;
  }

  async function handleSubmit() {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      await register({
        account_name: form.accountName.trim(),
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      showToast("Compte créé avec succès.", "success");
      router.replace("/(main)/home");
    } catch (error) {
      showToast(getApiErrorMessage(error), "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Créer un compte"
      subtitle="Configurez votre espace MonOpsX et votre compte administrateur."
    >
      <FormField label="Nom du compte" placeholder="Mon entreprise" value={form.accountName} error={errors.accountName} onChangeText={(value) => updateField("accountName", value)} autoCapitalize="words" />
      <View style={styles.row}>
        <View style={styles.column}>
          <FormField label="Prénom" placeholder="Votre prénom" value={form.firstName} error={errors.firstName} onChangeText={(value) => updateField("firstName", value)} autoCapitalize="words" />
        </View>
        <View style={styles.column}>
          <FormField label="Nom" placeholder="Votre nom" value={form.lastName} error={errors.lastName} onChangeText={(value) => updateField("lastName", value)} autoCapitalize="words" />
        </View>
      </View>
      <FormField autoComplete="email" keyboardType="email-address" label="Adresse e-mail" placeholder="nom@entreprise.com" value={form.email} error={errors.email} onChangeText={(value) => updateField("email", value)} />
      <FormField autoComplete="new-password" label="Mot de passe" placeholder="Créez un mot de passe" value={form.password} error={errors.password} onChangeText={(value) => updateField("password", value)} password />

      <View style={styles.rules}>
        {PASSWORD_RULES.map((rule) => {
          const valid = rule.test(form.password);
          return <Text key={rule.label} style={[styles.rule, valid ? styles.ruleValid : null]}>{valid ? "✓" : "•"} {rule.label}</Text>;
        })}
      </View>

      <FormField autoComplete="new-password" label="Confirmer le mot de passe" placeholder="Répétez le mot de passe" value={form.confirmation} error={errors.confirmation} onChangeText={(value) => updateField("confirmation", value)} onSubmitEditing={handleSubmit} password returnKeyType="done" />
      <PrimaryButton label="Créer mon compte" loading={isSubmitting} onPress={handleSubmit} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Vous avez déjà un compte ?</Text>
        <Link href="/(auth)/login" asChild>
          <Pressable hitSlop={8}><Text style={styles.link}>Se connecter</Text></Pressable>
        </Link>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  column: { flex: 1, minWidth: 180 },
  rules: { marginTop: -6, marginBottom: 16, gap: 4 },
  rule: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12 },
  ruleValid: { color: colors.success },
  footer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 5, marginTop: 22 },
  footerText: { color: colors.muted, fontFamily: fonts.regular, fontSize: typography.body },
  link: { color: colors.primary, fontFamily: fonts.semiBold, fontSize: typography.body },
});

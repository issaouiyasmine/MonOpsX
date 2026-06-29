import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppShell } from "@/components/app-shell";
import { FormField } from "@/components/form-field";
import { PrimaryButton } from "@/components/primary-button";
import { Permissions } from "@/constants/permissions";
import { colors, fonts, radii, spacing, typography } from "@/constants/theme";
import type { Profile } from "@/models/profile.model";
import { useAuth } from "@/providers/auth-provider";
import { useProfile } from "@/providers/profile-provider";
import { useToast } from "@/providers/toast-provider";
import { getApiErrorMessage } from "@/utils/api-error";
import { getPasswordError, isValidEmail } from "@/utils/validation";

function ProfileForms({ data }: { data: Profile }) {
  const { session } = useAuth();
  const { updateUser, updateAccount, updatePassword } = useProfile();
  const { showToast } = useToast();
  const [user, setUser] = useState({ first_name: data.user.first_name, last_name: data.user.last_name, email: data.user.email });
  const [account, setAccount] = useState({ name: data.account.name, email: data.account.email });
  const [passwords, setPasswords] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [savingUser, setSavingUser] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const canEditAccount = session?.permissions.includes(Permissions.ACCOUNT_UPDATE) ?? false;

  async function saveUser() {
    if (!user.first_name.trim() || !user.last_name.trim() || !isValidEmail(user.email)) {
      showToast("Vérifiez les informations utilisateur.", "warning");
      return;
    }
    setSavingUser(true);
    try {
      await updateUser(user);
      showToast("Profil mis à jour.");
    } catch (error) {
      showToast(getApiErrorMessage(error), "error");
    } finally {
      setSavingUser(false);
    }
  }

  async function saveAccount() {
    if (account.name.trim().length < 3 || !isValidEmail(account.email)) {
      showToast("Vérifiez les informations de société.", "warning");
      return;
    }
    setSavingAccount(true);
    try {
      await updateAccount(account);
      showToast("Société mise à jour.");
    } catch (error) {
      showToast(getApiErrorMessage(error), "error");
    } finally {
      setSavingAccount(false);
    }
  }

  async function savePassword() {
    const passwordError = getPasswordError(passwords.new_password);
    if (!passwords.current_password || passwordError || passwords.new_password !== passwords.confirm_password) {
      showToast(passwordError ?? "Les mots de passe ne correspondent pas.", "warning");
      return;
    }
    setSavingPassword(true);
    try {
      await updatePassword({
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      });
      setPasswords({ current_password: "", new_password: "", confirm_password: "" });
      showToast("Mot de passe mis à jour.");
    } catch (error) {
      showToast(getApiErrorMessage(error), "error");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <View style={styles.grid}>
      <View style={styles.card}>
        <Text style={styles.heading}>Informations utilisateur</Text>
        <FormField label="Prénom" value={user.first_name} onChangeText={(value) => setUser({ ...user, first_name: value })} />
        <FormField label="Nom" value={user.last_name} onChangeText={(value) => setUser({ ...user, last_name: value })} />
        <FormField label="Adresse e-mail" keyboardType="email-address" value={user.email} onChangeText={(value) => setUser({ ...user, email: value })} />
        <PrimaryButton label="Enregistrer le profil" loading={savingUser} onPress={saveUser} />
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Mettre à jour le mot de passe</Text>
        <FormField label="Mot de passe actuel" password value={passwords.current_password} onChangeText={(value) => setPasswords({ ...passwords, current_password: value })} />
        <FormField label="Nouveau mot de passe" password value={passwords.new_password} onChangeText={(value) => setPasswords({ ...passwords, new_password: value })} />
        <FormField label="Confirmer le mot de passe" password value={passwords.confirm_password} onChangeText={(value) => setPasswords({ ...passwords, confirm_password: value })} />
        <PrimaryButton label="Mettre à jour" loading={savingPassword} onPress={savePassword} />
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Informations société</Text>
        <FormField editable={canEditAccount} label="Nom de la société" value={account.name} onChangeText={(value) => setAccount({ ...account, name: value })} />
        <FormField editable={canEditAccount} label="E-mail de la société" keyboardType="email-address" value={account.email} onChangeText={(value) => setAccount({ ...account, email: value })} />
        {canEditAccount ? (
          <PrimaryButton label="Enregistrer la société" loading={savingAccount} onPress={saveAccount} />
        ) : (
          <Text style={styles.notice}>Vous pouvez consulter ces informations, mais votre rôle ne permet pas de les modifier.</Text>
        )}
      </View>
    </View>
  );
}

export default function ProfilePage() {
  const { profile, load } = useProfile();
  const { showToast } = useToast();

  useEffect(() => {
    if (!profile) {
      const timeout = setTimeout(() => {
        load().catch((error) => showToast(getApiErrorMessage(error), "error"));
      }, 0);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [profile, load, showToast]);

  return (
    <AppShell title="Profil">
      {profile ? <ProfileForms key={`${profile.user.email}-${profile.account.name}`} data={profile} /> : <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} />}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.lg,
  },
  card: {
    flex: 1,
    minWidth: 280,
    maxWidth: 620,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.medium,
    padding: spacing.lg,
  },
  heading: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: typography.h3,
    marginBottom: spacing.lg,
  },
  notice: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    lineHeight: 20,
  },
});

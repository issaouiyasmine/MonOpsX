import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppShell } from "@/components/app-shell";
import { FormField } from "@/components/form-field";
import { PrimaryButton } from "@/components/primary-button";
import { colors, fonts, radii, spacing, typography } from "@/constants/theme";
import type { CreatedServer, CreateServerPayload } from "@/models/server.model";
import { useToast } from "@/providers/toast-provider";
import { ServerService } from "@/services/server.service";
import { getApiErrorMessage } from "@/utils/api-error";

type FormErrors = Partial<Record<keyof CreateServerPayload, string>>;

const initialForm: CreateServerPayload = {
  name: "",
  hostname: "",
  ip: "",
};

export default function CreateServer() {
  const { showToast } = useToast();
  const [form, setForm] = useState<CreateServerPayload>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [createdServer, setCreatedServer] = useState<CreatedServer | null>(null);

  function updateField(field: keyof CreateServerPayload, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submit() {
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const server = await ServerService.create({
        name: form.name.trim(),
        hostname: form.hostname.trim(),
        ip: form.ip.trim(),
      });
      setCreatedServer(server);
      showToast("Serveur créé avec succès.");
    } catch (error) {
      showToast(getApiErrorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  }

  function openDetails() {
    if (!createdServer) return;
    router.push({
      pathname: "/(main)/servers/details",
      params: {
        serverId: createdServer.id,
        serverName: createdServer.name,
        hostname: createdServer.hostname,
        ip: createdServer.ip,
      },
    } as never);
  }

  return (
    <AppShell title="Créer un serveur">
      <View style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.heading}>Nouveau serveur</Text>
            <Text style={styles.subheading}>
              Créez le serveur, puis copiez le token dans la configuration de l'agent MonOpsX.
            </Text>
          </View>
          <Pressable style={styles.secondaryButton} onPress={() => router.push("/(main)/servers" as never)}>
            <Ionicons name="arrow-back-outline" size={18} color={colors.text} />
            <Text style={styles.secondaryButtonText}>Retour aux serveurs</Text>
          </Pressable>
        </View>

        <View style={styles.formCard}>
          <FormField
            label="Nom"
            value={form.name}
            placeholder="Machine locale"
            error={errors.name}
            onChangeText={(value) => updateField("name", value)}
          />
          <FormField
            label="Nom d'hôte"
            value={form.hostname}
            placeholder="localhost"
            error={errors.hostname}
            onChangeText={(value) => updateField("hostname", value)}
          />
          <FormField
            label="Adresse IP"
            value={form.ip}
            placeholder="127.0.0.1"
            error={errors.ip}
            keyboardType="numeric"
            onChangeText={(value) => updateField("ip", value)}
          />
          <PrimaryButton label="Créer le serveur" loading={saving} onPress={submit} />
        </View>

        {createdServer && (
          <View style={styles.tokenCard}>
            <View style={styles.tokenHeader}>
              <Ionicons name="key-outline" size={22} color={colors.primary} />
              <Text style={styles.tokenTitle}>Token de l'agent</Text>
            </View>
            <Text style={styles.tokenHelp}>
              Ce token est affiché uniquement après la création. Ajoutez-le dans le fichier .env de l'agent.
            </Text>
            <Text selectable style={styles.tokenValue}>
              {createdServer.webhook_token}
            </Text>

            <View style={styles.instructions}>
              <Instruction label="MONOPSX_API_URL" value="http://localhost:8000" />
              <Instruction label="MONOPSX_WEBHOOK_TOKEN" value={createdServer.webhook_token} />
              <Instruction label="MONOPSX_INTERVAL_SECONDS" value="30" />
            </View>

            <Text style={styles.deployNote}>
              Sur un serveur distant, remplacez l'URL locale par l'URL publique de l'API MonOpsX.
            </Text>

            <Pressable style={styles.openButton} onPress={openDetails}>
              <Ionicons name="analytics-outline" size={18} color={colors.text} />
              <Text style={styles.openButtonText}>Voir le serveur</Text>
            </Pressable>
          </View>
        )}
      </View>
    </AppShell>
  );
}

function Instruction({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.instructionRow}>
      <Text style={styles.instructionLabel}>{label}</Text>
      <Text selectable style={styles.instructionValue}>
        {value}
      </Text>
    </View>
  );
}

function validateForm(form: CreateServerPayload) {
  const nextErrors: FormErrors = {};
  if (!form.name.trim()) nextErrors.name = "Le nom est obligatoire.";
  if (!form.hostname.trim()) nextErrors.hostname = "Le nom d'hôte est obligatoire.";
  if (!form.ip.trim()) nextErrors.ip = "L'adresse IP est obligatoire.";
  return nextErrors;
}

const styles = StyleSheet.create({
  page: {
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  heading: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: typography.h2,
  },
  subheading: {
    maxWidth: 720,
    marginTop: spacing.xs,
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
  },
  formCard: {
    maxWidth: 680,
    gap: spacing.xs,
    borderRadius: radii.medium,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButton: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.medium,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: typography.body,
  },
  tokenCard: {
    maxWidth: 780,
    gap: spacing.md,
    borderRadius: radii.medium,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  tokenHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  tokenTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: typography.h3,
  },
  tokenHelp: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
  },
  tokenValue: {
    borderRadius: radii.small,
    padding: spacing.md,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: typography.body,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  instructions: {
    gap: spacing.sm,
  },
  instructionRow: {
    gap: spacing.xs,
  },
  instructionLabel: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: typography.caption,
  },
  instructionValue: {
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: typography.body,
  },
  deployNote: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
  },
  openButton: {
    minHeight: 42,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.medium,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primaryDark,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  openButtonText: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: typography.body,
  },
});

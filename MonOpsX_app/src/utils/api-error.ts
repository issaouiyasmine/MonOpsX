import { isAxiosError } from "axios";

const API_MESSAGES: Record<string, string> = {
  "Invalid email or password": "E-mail ou mot de passe incorrect.",
  "Email is already registered": "Cette adresse e-mail est déjà utilisée.",
  "User is inactive": "Ce compte est inactif.",
  "User is locked": "Ce compte est verrouillé.",
  "Invalid refresh token": "Votre session a expiré.",
  "Refresh token has expired": "Votre session a expiré.",
  "Password must not exceed 72 bytes": "Le mot de passe ne doit pas dépasser 72 octets.",
  "Password must contain at least one uppercase letter": "Le mot de passe doit contenir au moins une majuscule.",
  "Password must contain at least one lowercase letter": "Le mot de passe doit contenir au moins une minuscule.",
  "Password must contain at least one digit": "Le mot de passe doit contenir au moins un chiffre.",
  "Password must contain at least one special character": "Le mot de passe doit contenir au moins un caractère spécial.",
  "Role not found": "Le rôle demandé est introuvable.",
  "Role name already exists": "Un rôle porte déjà ce nom.",
  "User not found": "L'utilisateur est introuvable.",
  "The principal user's role and active status cannot be changed": "Le rôle et le statut de l'utilisateur principal ne peuvent pas être modifiés.",
  "The principal user cannot be deleted": "L'utilisateur principal ne peut pas être supprimé.",
  "The default Admin role cannot be changed": "Le rôle Admin par défaut ne peut pas être modifié.",
  "The default Admin role cannot be deleted": "Le rôle Admin par défaut ne peut pas être supprimé.",
  "You do not have permission to perform this action": "Vous n'avez pas la permission d'effectuer cette action.",
};

function translate(message: string): string {
  return API_MESSAGES[message] ?? message;
}

export function getApiErrorMessage(error: unknown): string {
  if (!isAxiosError(error)) {
    return "Une erreur inattendue est survenue.";
  }

  if (!error.response) {
    return "Impossible de joindre le serveur. Vérifiez votre connexion et l'adresse de l'API.";
  }

  const detail = error.response.data?.detail;
  if (typeof detail === "string") return translate(detail);

  if (Array.isArray(detail)) {
    const message = detail.find((item) => typeof item?.msg === "string")?.msg;
    if (message) return translate(message.replace(/^Value error,\s*/i, ""));
  }

  return "La demande n'a pas pu être traitée.";
}

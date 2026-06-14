import { create } from "axios";
import Constants from "expo-constants";

const metroHost = Constants.expoConfig?.hostUri?.split(":")[0];
const developmentUrl = metroHost ? `http://${metroHost}:8000` : "http://localhost:8000";

export const api = create({
  baseURL: process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") || developmentUrl,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

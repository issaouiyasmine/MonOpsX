import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from "react";
import type { Profile, UpdateProfileAccount, UpdateProfilePassword, UpdateProfileUser } from "@/models/profile.model";
import { ProfileService } from "@/services/profile.service";

interface Value { profile: Profile | null; loading: boolean; load: () => Promise<void>; updateUser: (p: UpdateProfileUser) => Promise<void>; updateAccount: (p: UpdateProfileAccount) => Promise<void>; updatePassword: (p: UpdateProfilePassword) => Promise<void>; clear: () => void }
const ProfileContext = createContext<Value | null>(null);

export function ProfileProvider({ children }: PropsWithChildren) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => { setLoading(true); try { setProfile(await ProfileService.get()); } finally { setLoading(false); } }, []);
  const updateUser = useCallback(async (p: UpdateProfileUser) => setProfile(await ProfileService.updateUser(p)), []);
  const updateAccount = useCallback(async (p: UpdateProfileAccount) => setProfile(await ProfileService.updateAccount(p)), []);
  const updatePassword = useCallback(async (p: UpdateProfilePassword) => setProfile(await ProfileService.updatePassword(p)), []);
  const clear = useCallback(() => setProfile(null), []);
  const value = useMemo(() => ({ profile, loading, load, updateUser, updateAccount, updatePassword, clear }), [profile, loading, load, updateUser, updateAccount, updatePassword, clear]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
export function useProfile() { const value = useContext(ProfileContext); if (!value) throw new Error("useProfile must be used inside ProfileProvider"); return value; }

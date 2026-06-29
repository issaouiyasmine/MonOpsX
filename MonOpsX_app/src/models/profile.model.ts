export interface Profile {
  user: { id: string; first_name: string; last_name: string; email: string; role_id: string; is_principal: boolean };
  account: { id: string; name: string; email: string };
}
export interface UpdateProfileUser { first_name: string; last_name: string; email: string }
export interface UpdateProfileAccount { name: string; email: string }
export interface UpdateProfilePassword { current_password: string; new_password: string }
export interface DeleteAccountPayload { password: string }

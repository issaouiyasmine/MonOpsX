export interface Role { id: string; name: string; permissions: number[]; is_default: boolean }
export interface User {
  id: string; first_name: string; last_name: string; email: string; role_id: string;
  is_active: boolean; is_principal: boolean; is_first_login: boolean;
}
export interface CreateUserPayload { first_name: string; last_name: string; email: string; role_id: string; temporary_password: string }
export interface UpdateUserPayload { first_name?: string; last_name?: string; email?: string; role_id?: string; is_active?: boolean }
export interface RolePayload { name: string; permissions: number[] }

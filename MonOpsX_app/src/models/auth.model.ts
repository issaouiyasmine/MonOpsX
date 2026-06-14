export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  account_name: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}

export interface AuthSession {
  user_id: string;
  account_id: string;
  email: string;
  access_token: string;
  refresh_token: string;
  role_id: string;
  permissions: number[];
  is_principal: boolean;
  token_type: "bearer" | string;
}

import unittest
from pydantic import ValidationError
from app.schemas.user import CreateUserRequest


class CreateUserPasswordTests(unittest.TestCase):
    def request(self, password: str):
        return CreateUserRequest(first_name="Test", last_name="User", email="user@example.com", role_id="role", temporary_password=password)

    def test_accepts_strong_password(self):
        self.assertEqual(self.request("MonOpsX#2026!").temporary_password, "MonOpsX#2026!")

    def test_rejects_weak_password(self):
        with self.assertRaises(ValidationError):
            self.request("weakpassword")


if __name__ == "__main__":
    unittest.main()

import unittest

from pydantic import ValidationError

from app.schemas.account_schema import CreateAccountRequest


class CreateAccountPasswordTests(unittest.TestCase):
    def build_request(self, password: str) -> CreateAccountRequest:
        return CreateAccountRequest(
            account_name="MonOpsX Test",
            first_name="Yasmine",
            last_name="Issaoui",
            email="test@example.com",
            password=password,
        )

    def assert_password_rejected(self, password: str, message: str) -> None:
        with self.assertRaises(ValidationError) as context:
            self.build_request(password)

        self.assertIn(message, str(context.exception))

    def test_accepts_strong_password(self) -> None:
        request = self.build_request("MonOpsX#2026!")
        self.assertEqual(request.password, "MonOpsX#2026!")

    def test_rejects_password_shorter_than_twelve_characters(self) -> None:
        self.assert_password_rejected("Short#2026", "at least 12 characters")

    def test_rejects_password_without_uppercase(self) -> None:
        self.assert_password_rejected("monopsx#2026!", "uppercase letter")

    def test_rejects_password_without_lowercase(self) -> None:
        self.assert_password_rejected("MONOPSX#2026!", "lowercase letter")

    def test_rejects_password_without_digit(self) -> None:
        self.assert_password_rejected("MonOpsX#Secure!", "digit")

    def test_rejects_password_without_special_character(self) -> None:
        self.assert_password_rejected("MonOpsXSecure2026", "special character")

    def test_rejects_password_over_seventy_two_bytes(self) -> None:
        self.assert_password_rejected("Aa1!" + "x" * 69, "72 bytes")


if __name__ == "__main__":
    unittest.main()

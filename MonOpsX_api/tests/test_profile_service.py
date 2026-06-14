import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from app.schemas.profile import UpdateProfileAccountRequest, UpdateProfileUserRequest
from app.services.profile_service import ProfileService


class ProfileServiceTests(unittest.IsolatedAsyncioTestCase):
    @patch("app.services.profile_service.AccountRepository.find_by_id", new_callable=AsyncMock)
    @patch("app.services.profile_service.UserRepository.find_by_id", new_callable=AsyncMock)
    async def test_get_profile_returns_user_and_account(self, find_user, find_account):
        find_user.return_value = SimpleNamespace(first_name="Yasmine", last_name="Issaoui", email="y@example.com", role_id="role-1", is_principal=True)
        find_account.return_value = {"name": "MonOpsX", "email": "contact@example.com"}
        result = await ProfileService.get_profile("account-1", "user-1")
        self.assertEqual(result["user"]["first_name"], "Yasmine")
        self.assertEqual(result["account"]["name"], "MonOpsX")

    @patch("app.services.profile_service.UsersRepository.find_by_email", new_callable=AsyncMock)
    async def test_update_user_rejects_duplicate_email(self, find_by_email):
        find_by_email.return_value = {"_id": "another-user"}
        with self.assertRaises(HTTPException) as context:
            await ProfileService.update_user("account-1", "user-1", UpdateProfileUserRequest(first_name="Yasmine", last_name="Issaoui", email="used@example.com"))
        self.assertEqual(context.exception.status_code, 409)

    @patch("app.services.profile_service.ProfileService.get_profile", new_callable=AsyncMock)
    @patch("app.services.profile_service.MetadataRepository.update_metadata", new_callable=AsyncMock)
    @patch("app.services.profile_service.AccountRepository.update", new_callable=AsyncMock)
    async def test_update_account_synchronizes_global_and_local_metadata(self, update_account, update_metadata, get_profile):
        get_profile.return_value = {"user": {}, "account": {}}
        request = UpdateProfileAccountRequest(name="Nouvelle Société", email="societe@example.com")
        await ProfileService.update_account("account-1", "user-1", request)
        update_account.assert_awaited_once()
        update_metadata.assert_awaited_once_with("account-1", "Nouvelle Société", "societe@example.com")


if __name__ == "__main__":
    unittest.main()

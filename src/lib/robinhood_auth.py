import requests

HEADERS = {
    "Accept": "*/*",
    "Content-Type": "application/json",
    "X-Robinhood-API-Version": "1.315.0",
    "User-Agent": "Robinhood/10.0.0 (Android; 10)"
}

BASE_URL = "https://api.robinhood.com"
device_token = "00000000-0000-0000-0000-000000000000"  # can randomize for safety
challenge_store = {}  # username -> challenge_id
token_store = {}      # username -> auth_token


def start_login(username: str, password: str):
    payload = {
        "username": username,
        "password": password,
        "device_token": device_token
    }

    res = requests.post(f"{BASE_URL}/oauth2/token/", json=payload, headers=HEADERS)
    if res.status_code == 200 and "access_token" in res.json():
        token_store[username] = res.json()["access_token"]
        return {"success": True}

    data = res.json()
    if "mfa_required" in data:
        challenge_id = data["challenge"]["id"]
        challenge_store[username] = {"challenge_id": challenge_id, "username": username, "password": password}
        return {"2FA_REQUIRED": True}
    
    return {"error": data.get("detail", "Login failed")}
    

def verify_mfa_code(username: str, code: str):
    if username not in challenge_store:
        return {"error": "No challenge found"}

    challenge_id = challenge_store[username]["challenge_id"]
    password = challenge_store[username]["password"]

    verify_url = f"{BASE_URL}/challenge/{challenge_id}/respond/"
    res = requests.post(verify_url, json={"response": code}, headers=HEADERS)

    if res.status_code == 200:
        # Retry login now that MFA is verified
        return start_login(username, password)
    else:
        return {"error": "Invalid 2FA code"}
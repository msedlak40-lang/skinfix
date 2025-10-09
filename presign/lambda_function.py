# file: lambda_function.py  (skinfix-presign-upload)
import os, json, time, base64, hmac, hashlib
import boto3

S3_BUCKET = os.environ.get("HIPAA_BUCKET", "skinfix-hipaa-media-616928071653-us-east-2")
KMS_KEY_ID = os.environ.get("KMS_KEY_ARN", "arn:aws:kms:us-east-2:616928071653:key/7622d747-ebbc-4c68-8c48-4c832b168dd5")
SUPABASE_JWT_SECRET = os.environ["SUPABASE_JWT_SECRET"]
ALLOW_ANON = os.environ.get("ALLOW_ANON", "false").lower() == "true"

s3 = boto3.client("s3")

def _b64url_decode(s: str) -> bytes:
    s += "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s.encode())

def verify_hs256(jwt_token: str, secret: str):
    # returns (header, claims) or raises ValueError
    try:
        header_b64, payload_b64, sig_b64 = jwt_token.split(".")
    except ValueError:
        raise ValueError("malformed_jwt")

    signing_input = f"{header_b64}.{payload_b64}".encode()
    expected = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    actual = _b64url_decode(sig_b64)
    if not hmac.compare_digest(expected, actual):
        raise ValueError("bad_signature")

    header = json.loads(_b64url_decode(header_b64))
    claims = json.loads(_b64url_decode(payload_b64))
    now = int(time.time())
    if "exp" in claims and now > int(claims["exp"]):
        raise ValueError("token_expired")
    return header, claims

def is_staff(claims: dict) -> bool:
    # Your staff gating: customize as needed
    # Examples:
    #  - claims.get("role") == "authenticated"
    #  - claims.get("app_metadata", {}).get("staff") is True
    am = claims.get("app_metadata") or {}
    return bool(am.get("staff") or am.get("roles") == "staff" or claims.get("role") == "authenticated")

def parse_body(event):
    try:
        body = event.get("body") or "{}"
        if event.get("isBase64Encoded"):
            body = base64.b64decode(body).decode()
        data = json.loads(body)
    except Exception:
        raise ValueError("invalid_json")

    # Minimal schema
    cust_id = (data.get("cust_id") or "").strip()
    object_name = (data.get("object_name") or "").strip()
    content_type = (data.get("content_type") or "application/octet-stream").strip()
    if not cust_id or not object_name:
        raise ValueError("missing_fields")

    return cust_id, object_name, content_type

def make_resp(status, body, headers=None):
    h = {
        "content-type": "application/json",
        "access-control-allow-origin": "https://dazzling-lebkuchen-254602.netlify.app",
        "access-control-allow-credentials": "false",
        "access-control-allow-headers": "authorization,content-type",
        "access-control-allow-methods": "OPTIONS,POST",
    }
    if headers: h.update(headers)
    return {"statusCode": status, "headers": h, "body": json.dumps(body)}

def lambda_handler(event, context):
    # CORS preflight
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return make_resp(204, {})

    # 1) AuthN/AuthZ
    auth = (event.get("headers") or {}).get("authorization") or (event.get("headers") or {}).get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        return make_resp(401, {"error":"missing_authorization"})

    token = auth.split(" ", 1)[1].strip()
    try:
        _, claims = verify_hs256(token, SUPABASE_JWT_SECRET)
    except ValueError as e:
        # If you want to allow the anon key only when ALLOW_ANON=true
        if ALLOW_ANON:
            try:
                _, claims = verify_hs256(token, SUPABASE_JWT_SECRET)  # same verification (anon is just another JWT)
            except Exception:
                return make_resp(401, {"error":"invalid_token"})
        else:
            return make_resp(401, {"error": str(e)})

    if claims.get("aud") != "authenticated":
        return make_resp(403, {"error":"bad_audience"})

    if not is_staff(claims):
        return make_resp(403, {"error":"forbidden"})

    # 2) Body + key shaping
    try:
        cust_id, object_name, content_type = parse_body(event)
    except ValueError as e:
        return make_resp(400, {"error": str(e)})

    # Store under a prefixed path by cust_id + date
    # Example: media/<cust_id>/2025/09/27/<filename>
    key = f"media/{cust_id}/{time.strftime('%Y/%m/%d')}/{object_name}"

    # 3) Presign PUT with SSE-KMS enforced and helpful metadata
    params = {
        "Bucket": S3_BUCKET,
        "Key": key,
    }
    headers = {
        "x-amz-server-side-encryption": "aws:kms",
        "x-amz-server-side-encryption-aws-kms-key-id": KMS_KEY_ID,
        "Content-Type": content_type,
        # Non-PHI metadata:
        "x-amz-meta-cust_id": cust_id,
        "x-amz-meta-source": "pwa",
    }

    # Create a presigned URL for PUT
    url = s3.generate_presigned_url(
        ClientMethod="put_object",
        Params={**params, "ContentType": content_type,
                "ServerSideEncryption": "aws:kms",
                "SSEKMSKeyId": KMS_KEY_ID,
                "Metadata": {"cust_id": cust_id, "source": "pwa"}},
        ExpiresIn=300,
        HttpMethod="PUT",
    )

    return make_resp(200, {
        "bucket": S3_BUCKET,
        "key": key,
        "url": url,
        "headers": headers  # the PWA should set these on the PUT
    })

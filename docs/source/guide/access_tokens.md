---
title: Access tokens
short: Access tokens
tier: all
type: guide
order: 381
order_enterprise: 359
meta_title: Access tokens
meta_description: Access tokens to interact with the Label Studio API and SDK. 
section: "Manage Your Organization"
date: 2025-02-18 12:03:59
---

Label Studio has personal access tokens and legacy tokens. The options available to users are set at the Organization level. Se [Access settings for orgs](#Access-token-settings-for-orgs) below. 

<table>
<thead>
  <tr>
    <th>Personal Access Token</th>
    <th>Legacy Token</th>
  </tr>
  </thead>
  <tr>
  <td>
    <ul>
        <li>Have a TTL that can be set at the org level. (Label Studio Enterprise only)
        <li>Are only visible to users once
        <li>Can be manually revoked
        <li>Require extra steps when used with HTTP API
        <li>Only need to be set once when used SDK
    </ul>
  </td>
  <td>
    <ul>
        <li>Does not expire
        <li>Remains listed and available in your account settings
        <li>Can be manually revoked
        <li>Do not need to be refreshed with used with HTTP API
        <li>Only need to be set once when used SDK
    </ul>
  </td>
  </tr>
</table>

## Personal access tokens and the API

### SDK

Personal access tokens can be used with the Python SDK the same way in which legacy tokens were set:

```python
# Define the URL where Label Studio is accessible and the API key for your user account
LABEL_STUDIO_URL = 'http://localhost:8080'
# API key is available at the Account & Settings > Access Tokens page in Label Studio UI
API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....'

# Import the SDK and the client module
from label_studio_sdk.client import LabelStudio

# Connect to the Label Studio API and check the connection
ls = LabelStudio(base_url=LABEL_STUDIO_URL, api_key=API_KEY)

```

### HTTP API

If you are interacting directly via HTTP, the personal access token functions as a JWT refresh token.

You must use your personal access token (refresh token) to generate a short-lived access token. This access token is then used for API authentication.

To generate this access token, make a POST request with your personal access token in the JSON body. For example:
     
```bash
curl -X POST <your-label-studio-url>/api/token/refresh \
-H "Content-Type: application/json" \
-d '{"refresh": "your-personal-access-token"}'
```

In response, you will receive a JSON payload similar to:
     
```json
{
    "access": "your-new-access-token"
}
```

Use this access token by including it in your API requests via the Authorization header:
     
```http
Authorization: Bearer your-new-access-token
```

When that access token expires (after around 5 minutes) you’ll get a 401 response, and will need to use your personal access token again to acquire a new one. This adds an extra layer of security.

You can also check when the token is set to expire using the following script:

```python
# pip install pyjwt
from datetime import datetime, timezone
import jwt

decoded = jwt.decode(token)
exp = decoded.get("exp")
token_is_expired = (exp <= datetime.now(timezone.utc).timestamp())
```

## Access token settings for orgs

The options that are available to users depend on options selected at the organization level. 

From the **Organization** page, click **Access Token Settings** in the upper right. 

<div class="enterprise-only">

!!! note
    The **Organization** page is only available to users in the Admin and Owner role.

</div>

From here you can enable and disable token types. 

* When a certain token type is disabled, existing tokens will not be able to authenticate to the Label Studio platform. 

* Use the Personal Access Token Time-to-Live to set an expiration date for personal access tokens. This is only available for Label Studio Enterprise users. 


![Screenshot of Access Token window](/images/admin/token-settings.png)


## Finding your access token

You can create/manage your access token from your [**Account & Settings** page](user_account) (click your username in the upper right in Label Studio). 



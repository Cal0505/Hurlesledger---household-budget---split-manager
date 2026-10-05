<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/d3fe911a-6510-4941-a8ae-eda65bb5a795

## Run Locally

**Prerequisites:** Node.js 22 or later. Android builds additionally require Android Studio, JDK 21, and Android SDK Platform 36.

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and set your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Supabase Project Settings → API.
3. In the Supabase dashboard, open **SQL Editor**, paste and run [`supabase/schema.sql`](./supabase/schema.sql). This creates the household tables and access policies.
4. Create the first authorized household login under **Authentication → Users**. New household members can create an email-and-password login; only users approved into `household_access` can read or change household records.
5. Grant access to each created user in the SQL Editor. Replace the example email with the exact email for that login and run once per household user:

   ```sql
   insert into public.household_access (user_id)
   select id from auth.users where email = 'you@example.com'
   on conflict (user_id) do nothing;
   ```

6. For access requests and profile linking, run [`supabase/access_requests.sql`](./supabase/access_requests.sql) in the SQL Editor. Then run [`supabase/self_service_profiles.sql`](./supabase/self_service_profiles.sql). This migration allows access requests without a profile and requires approval before a profile can be created; rerun it to upgrade an earlier version of the self-service flow. For already-authorized users to securely link a member with the same verified email, run [`supabase/link_existing_account.sql`](./supabase/link_existing_account.sql).
7. Run [`supabase/account_holder_permissions.sql`](./supabase/account_holder_permissions.sql) after the other SQL scripts. It limits household member profile reads to account holders and each user's own profile, and restricts member changes and access-request approvals to account holders. Account-holder profiles with a matching authorized login email are linked automatically when the match is unambiguous. This is required for existing Supabase projects; the app also hides member details and controls from non-account-holders.
   To specifically make Carl the account holder, run [`supabase/promote_carl_account_holder.sql`](./supabase/promote_carl_account_holder.sql) after that migration. It promotes the unique profile named Carl and requires its email to match an already-authorized login.
   To create accounts without sending confirmation emails, open **Authentication → Sign In / Providers → Email** and turn off **Confirm email**. Supabase controls confirmation-email delivery; the application cannot suppress those emails while this setting is enabled.
8. Run the app:
   `npm run dev`

## Android Studio

The native Android Studio project is in [`HearthLedger_android`](./HearthLedger_android).

1. Install the JavaScript dependencies and configure `.env.local` as described above.
2. From the repository root, run `npm run android:sync`. This builds the web app with the configured Supabase values and copies it into the Android project. Run this again after changing the web app.
3. Open the `HearthLedger_android` folder in Android Studio and allow Gradle to sync. Select an Android 7.0+ emulator or connected device, then click **Run**.
4. To build a debug APK from Android Studio, select **Build → Build Bundle(s) / APK(s) → Build APK(s)**. Alternatively, run `.\gradlew.bat assembleDebug` from the `HearthLedger_android` directory.

The Android project uses the same Supabase backend as the web app. Do not put a Supabase service-role key in `.env.local`; only the publishable/anon key belongs in the client app.

The app starts with an empty household; it does not import the old browser demo data. Members, bills, transactions, and household settings are now stored in Supabase and shared by authorized logins. The app checks database access after sign-in and reports load/save errors. Use only the publishable/anon key in `.env.local`; never put a service-role key in browser code.

Users enter their email and password and choose **Sign in**. If the credentials are not recognized, they can choose **Create account** using those details. After signing in, they submit an access request with no profile details. An authorized household user approves access under **Member Profiles → Access requests**. Only after approval can the new user create their household profile. Supabase Auth securely stores and manages login credentials.

An already-authorized user can link their own login from **Member Profiles** when the selected member has the same email address as the user’s verified Supabase login. The database checks the email match and prevents linking a profile already assigned to another login.

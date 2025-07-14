// gatekeeper.js

// --- IMPORTANT: PASTE YOUR SUPABASE KEYS HERE ---
// These keys should be the same as the ones on your landing page.
const SUPABASE_URL = 'https://apmrjfzlbhncygmbhzbh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwbXJqZnpsYmhuY3lnbWJoemJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0MTcwMjEsImV4cCI6MjA2Nzk5MzAyMX0.R0SWhl3mtGveMA5klvTZP2S4mLxd-aXQFDnYAjcfIN4';
// ---------------------------------------------

// Initialize the Supabase client
const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * This is the main function that protects the application.
 * It checks for a valid session and an active subscription.
 */
async function protectPage() {
    // 1. Get the current user session
    const { data: { session }, error: sessionError } = await _supabase.auth.getSession();

    if (sessionError) {
        console.error('Error getting session:', sessionError);
        redirectToLanding();
        return;
    }

    if (!session) {
        // If no user is logged in, redirect them immediately.
        redirectToLanding();
        return;
    }

    // 2. If a user is logged in, check for an active subscription in your database.
    // This assumes you have a 'subscriptions' table with a 'user_id' that matches auth.users.id
    // and a 'status' column that will be 'active' for paying users.
    const { data: subscription, error: subscriptionError } = await _supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', session.user.id)
        .in('status', ['active', 'trialing']) // Check for both active and trialing statuses
        .single(); // We only expect one active subscription per user

    if (subscriptionError && subscriptionError.code !== 'PGRST116') {
        // PGRST116 means "No rows found", which is not a database error in this case.
        // We log any other real database errors.
        console.error('Error checking subscription:', subscriptionError);
    }

    if (subscription) {
        // 3. If the user has an active subscription, run the application.
        console.log('Access granted. Starting Mapping Slayer.');
        // The runApplication function is defined in main.js
        runApplication();
    } else {
        // 4. If there is no active subscription, redirect them.
        console.log('Access denied. No active subscription found.');
        redirectToLanding();
    }
}

/**
 * Redirects the user to the main landing page.
 */
function redirectToLanding() {
    // This redirects the user to the landing page with a reason.
    // This allows the landing page to show a specific message.
    window.location.href = 'mapping_slayer_landing.html?reason=unsubscribed';
}

// Run the protection check as soon as the script loads.
protectPage();
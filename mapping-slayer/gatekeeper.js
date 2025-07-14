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
    console.log('🔐 Gatekeeper: Starting protection check...');
    
    // 1. Get the current user session
    const { data: { session }, error: sessionError } = await _supabase.auth.getSession();

    if (sessionError) {
        console.error('❌ Error getting session:', sessionError);
        redirectToLanding();
        return;
    }

    if (!session) {
        console.log('❌ No user session found');
        redirectToLanding();
        return;
    }

    console.log('✅ User session found:', session.user.email);

    // 2. If a user is logged in, check for an active subscription in your database.
    console.log('🔍 Checking subscription for user:', session.user.id);
    
    const { data: subscription, error: subscriptionError } = await _supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', session.user.id)
        .in('status', ['active', 'trialing']) // Check for both active and trialing statuses
        .single(); // We only expect one active subscription per user

    console.log('📊 Subscription query result:', { subscription, subscriptionError });

    if (subscriptionError && subscriptionError.code !== 'PGRST116') {
        // PGRST116 means "No rows found", which is not a database error in this case.
        console.error('❌ Database error checking subscription:', subscriptionError);
    }

    if (subscription) {
        console.log('✅ Active subscription found:', subscription.status);
        console.log('🚀 Access granted. Starting Mapping Slayer.');
        runApplication();
    } else {
        console.log('❌ No active subscription found');
        console.log('🔄 Redirecting to landing page');
        redirectToLanding();
    }
}

/**
 * Redirects the user to the main landing page.
 */
function redirectToLanding() {
    // This redirects the user to the landing page with a reason.
    // This allows the landing page to show a specific message.
    console.log('🔄 REDIRECT: About to redirect to landing page in 5 seconds...');
    console.log('🔄 Check the console messages above to see why access was denied');
    
    // Delay the redirect so we can see the console messages
    setTimeout(() => {
        window.location.href = 'mapping_slayer_landing.html?reason=unsubscribed';
    }, 5000);
}

// Run the protection check as soon as the script loads.
protectPage();
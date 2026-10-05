async function runTests() {
  const baseUrl = 'http://localhost:3001';
  console.log('🧪 Starting End-to-End Test Suite for Sourcing Copilot on', baseUrl);

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Test Transliteration Endpoint
  console.log('\n--- 1. Testing /api/transliterate (Hindi -> Hinglish) ---');
  try {
    const hindiInput = 'महाराष्ट्र के लिए एरिया सेल्स मैनेजर चाहिए 5 से 8 साल का एक्सपीरियंस रोटावेटर और शक्तिमान बैकग्राउंड';
    const res = await fetch(`${baseUrl}/api/transliterate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: hindiInput, target: 'hinglish' })
    });
    const data = await res.json();
    console.log('  Result text:', data.text);
    assert(data.success === true, 'Transliteration API responded with success');
    assert(data.text.includes('Maharashtra'), 'Properly mapped महाराष्ट्र -> Maharashtra');
    assert(data.text.includes('Area Sales Manager'), 'Properly mapped एरिया सेल्स मैनेजर -> Area Sales Manager');
    assert(data.text.includes('Rotavator'), 'Properly mapped रोटावेटर -> Rotavator');
    assert(data.text.toLowerCase().includes('shaktiman'), 'Properly mapped शक्तिमान -> Shaktiman');
    assert(data.text.includes('chahiye'), 'Properly mapped चाहिए -> chahiye');
  } catch (err) {
    assert(false, `Transliteration API threw error: ${err.message}`);
  }

  // 2. Test Sourcing Strategy & Query Generation
  console.log('\n--- 2. Testing /api/generate (Position Intake & Boolean Building) ---');
  let createdPosition = null;
  try {
    const brief = 'Client ko Maharashtra territory ke liye Area Sales Manager chahiye for Rotavator, MB Plough aur active tillage implements. 5 se 8 saal ka experience mandatory hai. Candidates Shaktiman, Lemken, Fieldking ya Mahindra background se hone chahiye. Dealer network expansion aur secondary sales dekhna hoga.';
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: brief, inputType: 'text' })
    });
    const data = await res.json();
    assert(data.success === true, 'Generate API responded with success');
    createdPosition = data.position;
    assert(!!createdPosition?.id, `Position created with ID: ${createdPosition?.id}`);
    assert(createdPosition?.parsed?.locations?.includes('Maharashtra'), 'Parsed target location: Maharashtra');
    assert(createdPosition?.parsed?.equipmentFocus?.some(e => /rotavator|plough|tillage/i.test(e)), 'Identified Rotavator/Tillage equipment focus');
    assert(createdPosition?.parsed?.targetCompanies?.some(c => /shaktiman|lemken|fieldking/i.test(c)), 'Target competitor OEMs identified (Shaktiman, Lemken)');

    // Verify Portal Queries
    const queries = createdPosition?.queries;
    assert(!!queries?.naukri?.booleanQuery && queries.naukri.booleanQuery.includes('NOT'), 'Naukri Boolean contains keywords & exclusions');
    assert(!!queries?.googleXray?.directUrl && queries.googleXray.directUrl.startsWith('https://www.google.com/search?q='), 'Google X-Ray direct launch URL generated');
    assert(!!queries?.linkedin?.searchUrl && queries.linkedin.searchUrl.startsWith('https://www.linkedin.com/search'), 'LinkedIn direct search URL generated');
    assert(!!queries?.referral?.whatsappTemplate && queries.referral.whatsappTemplate.includes('Urgent Hiring'), 'WhatsApp referral outreach template generated');
  } catch (err) {
    assert(false, `Generate API threw error: ${err.message}`);
  }

  // 3. Test Keyword Feedback Recording
  console.log('\n--- 3. Testing /api/feedback (Thumbs Up / Down Signals) ---');
  try {
    if (createdPosition) {
      // Upvote Rotavator
      const upRes = await fetch(`${baseUrl}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positionId: createdPosition.id,
          keywordText: 'Rotavator',
          category: 'equipment',
          portal: 'naukri',
          vote: 'up'
        })
      });
      const upData = await upRes.json();
      assert(upData.success === true, 'Upvoted keyword "Rotavator" successfully');

      // Downvote Software
      const downRes = await fetch(`${baseUrl}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positionId: createdPosition.id,
          keywordText: 'Software',
          category: 'exclusion',
          portal: 'naukri',
          vote: 'down'
        })
      });
      const downData = await downRes.json();
      assert(downData.success === true, 'Downvoted noisy keyword "Software" successfully');

      // Rate overall search
      const rateRes = await fetch(`${baseUrl}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rate_search',
          positionId: createdPosition.id,
          rating: 'excellent'
        })
      });
      const rateData = await rateRes.json();
      assert(rateData.success === true, 'Recorded overall search performance rating (excellent)');
    }
  } catch (err) {
    assert(false, `Feedback API threw error: ${err.message}`);
  }

  // 4. Test Positions History Retrieval
  console.log('\n--- 4. Testing /api/positions (History & Persistence) ---');
  try {
    const res = await fetch(`${baseUrl}/api/positions`);
    const data = await res.json();
    assert(data.success === true, 'Positions API returned 200 OK');
    assert(Array.isArray(data.positions) && data.positions.length > 0, `History contains ${data.positions?.length} positions`);
    const match = data.positions.find(p => p.id === createdPosition?.id);
    assert(!!match, 'Found newly created position in persisted history list');
    assert(match?.searchRating === 'excellent', 'Persisted search rating matches "excellent"');
  } catch (err) {
    assert(false, `Positions API threw error: ${err.message}`);
  }

  console.log(`\n========================================`);
  console.log(`🏁 Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

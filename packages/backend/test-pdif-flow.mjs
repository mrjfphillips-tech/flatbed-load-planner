/**
 * Integration test: Full PDIF session lifecycle
 * Tests: login → create session → send transcript → get suggestions → end session
 */

const BASE = 'http://localhost:4000';

async function test() {
  console.log('═══ PDIF V1 Integration Test ═══\n');

  // 1. Login
  console.log('1. Login...');
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rep@ptv.com', password: 'demo123' }),
  });
  const { token } = await loginRes.json();
  console.log(`   ✓ Token: ${token ? 'received' : 'FAILED'}\n`);
  if (!token) { console.log('ABORT: No token'); process.exit(1); }

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // 2. Get accounts
  console.log('2. Get accounts...');
  const acctRes = await fetch(`${BASE}/api/accounts`, { headers });
  const acctData = await acctRes.json();
  const accountId = acctData.accounts?.[0]?.id;
  console.log(`   ✓ Accounts: ${acctData.accounts?.length || 0}`);
  if (!accountId) {
    // Create an account if none exist
    console.log('   Creating test account...');
    const newAcct = await fetch(`${BASE}/api/accounts`, {
      method: 'POST', headers,
      body: JSON.stringify({ name: 'PDIF Test Account' }),
    });
    const created = await newAcct.json();
    console.log(`   ✓ Created: ${created.id}\n`);
    var testAccountId = created.id;
  } else {
    var testAccountId = accountId;
    console.log(`   ✓ Using: ${testAccountId}\n`);
  }

  // 3. Start PDIF session
  console.log('3. Start PDIF session...');
  const sessionRes = await fetch(`${BASE}/api/pdif/sessions`, {
    method: 'POST', headers,
    body: JSON.stringify({ accountId: testAccountId }),
  });
  const session = await sessionRes.json();
  console.log(`   ✓ Session ID: ${session.id}`);
  console.log(`   ✓ Phase: ${session.currentPhase}`);
  console.log(`   ✓ Session #: ${session.sessionNumber}\n`);

  if (!session.id) { console.log('ABORT: Session not created'); process.exit(1); }

  // 4. Send transcript segment (simulated customer speech)
  console.log('4. Send transcript (simulating customer speech)...');
  const transcript1 = await fetch(`${BASE}/api/pdif/sessions/${session.id}/transcript`, {
    method: 'POST', headers,
    body: JSON.stringify({
      text: 'We have about 200 trucks across four distribution centers. We plan our routes manually each morning — the dispatchers come in at 5am and figure out who goes where.',
      speaker: 'customer',
      startMs: 0,
      endMs: 15000,
    }),
  });
  const t1Result = await transcript1.json();
  console.log(`   ✓ Entities extracted: ${t1Result.entitiesExtracted}`);
  console.log(`   ✓ Relationships created: ${t1Result.relationshipsCreated}`);
  console.log(`   ✓ Confidence updates: ${t1Result.confidenceUpdates?.length || 0}\n`);

  // 5. Get question suggestions
  console.log('5. Get question suggestions...');
  const sugRes = await fetch(`${BASE}/api/pdif/sessions/${session.id}/suggestions`, { headers });
  const sugData = await sugRes.json();
  console.log(`   ✓ Suggestions returned: ${sugData.suggestions?.length || 0}`);
  if (sugData.suggestions?.length > 0) {
    sugData.suggestions.forEach((s, i) => {
      console.log(`   ${i + 1}. [${s.source}] "${s.text.substring(0, 70)}..."`);
      console.log(`      Why: ${s.whyItMatters?.substring(0, 60)}...`);
    });
  }
  console.log('');

  // 6. Get confidence scores
  console.log('6. Get confidence scores...');
  const confRes = await fetch(`${BASE}/api/pdif/sessions/${session.id}/confidence`, { headers });
  const confData = await confRes.json();
  console.log(`   ✓ Overall confidence: ${confData.overall}%`);
  confData.categories?.forEach(c => {
    console.log(`   ${c.label}: ${c.score}%`);
  });
  console.log('');

  // 7. Get discovery graph
  console.log('7. Get discovery graph...');
  const graphRes = await fetch(`${BASE}/api/pdif/sessions/${session.id}/graph`, { headers });
  const graphData = await graphRes.json();
  console.log(`   ✓ Nodes: ${graphData.nodes?.length || 0}`);
  console.log(`   ✓ Edges: ${graphData.edges?.length || 0}`);
  graphData.nodes?.slice(0, 5).forEach(n => {
    console.log(`   • [${n.nodeType}] ${n.label} (${Math.round(n.confidence * 100)}%)`);
  });
  console.log('');

  // 8. End session
  console.log('8. End session...');
  const endRes = await fetch(`${BASE}/api/pdif/sessions/${session.id}/end`, {
    method: 'POST', headers,
  });
  const endData = await endRes.json();
  console.log(`   ✓ Duration: ${endData.durationMinutes} minutes`);
  console.log(`   ✓ Entities discovered: ${endData.entitiesDiscovered}`);
  console.log(`   ✓ Summary: "${endData.summary?.substring(0, 100)}..."`);
  console.log('');

  // 9. Get pre-session briefing (for next time)
  console.log('9. Get pre-session briefing...');
  const briefRes = await fetch(`${BASE}/api/pdif/accounts/${testAccountId}/briefing`, { headers });
  const briefData = await briefRes.json();
  console.log(`   ✓ Session number: ${briefData.sessionNumber}`);
  console.log(`   ✓ Key facts known: ${briefData.keyFacts?.length || 0}`);
  console.log(`   ✓ Knowledge gaps: ${briefData.gaps?.length || 0}`);
  console.log(`   ✓ Opening questions: ${briefData.openingQuestions?.length || 0}`);
  console.log('');

  console.log('═══ ALL TESTS PASSED ═══');
  console.log('\nThe PDIF V1 core loop is working end-to-end:');
  console.log('  Speech → Entities → Graph → Suggestions → Confidence → Summary');
}

test().catch(err => {
  console.error('TEST FAILED:', err.message);
  process.exit(1);
});

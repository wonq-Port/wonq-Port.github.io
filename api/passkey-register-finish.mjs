
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const rpID = process.env.RP_ID || 'localhost';
// 슬래시가 붙어 있든 아니든 둘 다 허용하도록 처리
const rawOrigin = process.env.ORIGIN || `https://${rpID}`;
const expectedOrigins = [rawOrigin, rawOrigin.replace(/\/$/, ''), rawOrigin + '/'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const body = req.body;
  const { data: user } = await supabase.from('users').select('*').eq('username', 'master_user').single();
  
  // DB에 보관해둔 방금 전의 질문(Challenge) 가져오기
  const { data: challengeData } = await supabase.from('auth_challenges')
    .select('*').eq('user_id', user.id).eq('type', 'registration')
    .order('created_at', { ascending: false }).limit(1).single();

  if (!challengeData) return res.status(400).json({ error: 'Challenge expired or invalid' });

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: expectedOrigins, // 배열 형태로 여러 형태 허용
      expectedRPID: rpID,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  if (verification.verified) {
    const { registrationInfo } = verification;
    const pubKeyBase64 = Buffer.from(registrationInfo.credentialPublicKey).toString('base64');
    
    // 검증 성공 시 DB에 공개키 저장 (개인키는 서버로 오지 않음)
    await supabase.from('passkeys').insert({
      user_id: user.id,
      credential_id: registrationInfo.credentialID,
      public_key: pubKeyBase64,
      name: '등록된 기기 ' + new Date().toLocaleDateString(), // 나중에 기기 식별용
      sign_count: registrationInfo.counter
    });

    // 보안을 위해 사용한 질문 폐기
    await supabase.from('auth_challenges').delete().eq('id', challengeData.id);
    return res.status(200).json({ success: true });
  }

  res.status(400).json({ error: 'Verification failed' });
}

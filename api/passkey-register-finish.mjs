import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const sbUrl = process.env.SUPABASE_URL;
    const sbKey = process.env.SUPABASE_ANON_KEY;
    const rpID = process.env.RP_ID || 'localhost';
    const rawOrigin = process.env.ORIGIN || `https://${rpID}`;
    const expectedOrigins = [rawOrigin, rawOrigin.replace(/\/$/, ''), rawOrigin + '/'];

    const supabase = createClient(sbUrl, sbKey);
    const body = req.body;

    // 1. master_user 조회
    const { data: user } = await supabase.from('users').select('*').eq('username', 'master_user').single();
    if (!user) return res.status(400).json({ error: 'User not found' });
  
    // 2. 가장 최근의 registration 질문 가져오기
    const { data: challengeData } = await supabase.from('auth_challenges')
      .select('*').eq('user_id', user.id).eq('type', 'registration')
      .order('created_at', { ascending: false }).limit(1).single();

    if (!challengeData) return res.status(400).json({ error: 'Challenge expired or invalid' });

    // 3. 서명 검증
    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: expectedOrigins,
      expectedRPID: rpID,
    });

    if (verification.verified) {
      const { registrationInfo } = verification;
      const pubKeyBase64 = Buffer.from(registrationInfo.credentialPublicKey).toString('base64');
      
      // 핵심: credential_id를 확실한 문자열(base64url)로 변환해서 저장
      const cleanCredentialId = Buffer.from(registrationInfo.credentialID).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

      // 4. DB에 공개키 저장
      await supabase.from('passkeys').insert({
        user_id: user.id,
        credential_id: cleanCredentialId,
        public_key: pubKeyBase64,
        name: '등록된 기기 ' + new Date().toLocaleDateString(),
        sign_count: registrationInfo.counter
      });

      // 사용된 질문 삭제
      await supabase.from('auth_challenges').delete().eq('id', challengeData.id);
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Verification failed' });

  } catch (error) {
    console.error('Register Finish 에러:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

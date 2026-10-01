import { verifyAuthenticationResponse } from '@simplewebauthn/server';
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
    
    // 1. DB에 저장된 모든 패스키 중 일치하는 것 찾기
    const { data: passkeys } = await supabase.from('passkeys').select('*');
    const passkey = passkeys?.find(p => p.credential_id === body.id || p.credential_id === body.rawId);

    if (!passkey) {
      return res.status(400).json({ error: '등록되지 않은 기기입니다.' });
    }

    // 2. 최신 로그인 질문 가져오기
    const { data: challengeData } = await supabase.from('auth_challenges')
      .select('*').eq('type', 'authentication')
      .order('created_at', { ascending: false }).limit(1).single();

    if (!challengeData) return res.status(400).json({ error: 'Challenge missing' });

    // 3. 서명 검증
    let credentialPublicKeyBuffer;
    try {
      credentialPublicKeyBuffer = Buffer.from(passkey.public_key, 'base64');
    } catch (e) {
      credentialPublicKeyBuffer = Buffer.from(passkey.public_key, 'utf8');
    }

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: expectedOrigins,
      expectedRPID: rpID,
      authenticator: {
        credentialID: Buffer.from(body.id, 'base64'),
        credentialPublicKey: credentialPublicKeyBuffer,
        counter: passkey.sign_count
      }
    });

    if (verification.verified) {
      // 카운터 업데이트 및 질문 삭제
      await supabase.from('passkeys').update({ sign_count: verification.authenticationInfo.newCounter }).eq('id', passkey.id);
      await supabase.from('auth_challenges').delete().eq('id', challengeData.id);

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Verification failed' });

  } catch (error) {
    console.error('Login Finish 에러:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

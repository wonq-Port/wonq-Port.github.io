import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { createClient } from '@supabase/supabase-js';
import { serialize } from 'cookie';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const rpID = process.env.RP_ID || 'localhost';
const rawOrigin = process.env.ORIGIN || `https://${rpID}`;
const expectedOrigins = [rawOrigin, rawOrigin.replace(/\/$/, ''), rawOrigin + '/'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const body = req.body;
  
  // 1. 응답한 기기(credential_id)를 DB에서 찾기
  const { data: passkey } = await supabase.from('passkeys').select('*').eq('credential_id', body.id).single();
  if (!passkey) return res.status(400).json({ error: '등록되지 않은 기기입니다.' });

  // 2. 가장 최근 발행된 로그인 질문 가져오기
  const { data: challengeData } = await supabase.from('auth_challenges')
    .select('*').eq('type', 'authentication')
    .order('created_at', { ascending: false }).limit(1).single();

  if (!challengeData) return res.status(400).json({ error: 'Challenge missing' });

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: expectedOrigins, // 배열 형태로 여러 형태 허용
      expectedRPID: rpID,
      authenticator: {
        credentialID: passkey.credential_id,
        credentialPublicKey: Buffer.from(passkey.public_key, 'base64'),
        counter: passkey.sign_count
      }
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  if (verification.verified) {
    // 4. 서명 카운터 업데이트 및 사용된 질문 삭제
    await supabase.from('passkeys').update({ sign_count: verification.authenticationInfo.newCounter }).eq('id', passkey.id);
    await supabase.from('auth_challenges').delete().eq('id', challengeData.id);

    // 5. 로그인 성공 증표(쿠키) 발급 - Card 3 대응
    res.setHeader('Set-Cookie', serialize('auth_session', 'passkey_verified_user', {
      httpOnly: true, // 브라우저 JS에서 탈취 불가
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 2 // 2시간 유지
    }));

    return res.status(200).json({ success: true });
  }

  res.status(400).json({ error: 'Verification failed' });
}

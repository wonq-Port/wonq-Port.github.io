import { generateRegistrationOptions } from '@simplewebauthn/server';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    // 1. 환경변수 누락 체크 (여기서 걸리면 Vercel 재배포가 안 된 것입니다)
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      throw new Error('Vercel 환경변수(SUPABASE_URL 등)가 없습니다. Redeploy를 확인해주세요.');
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const rpName = '이혜원 포트폴리오 (비공개)';
    const rpID = process.env.RP_ID || 'localhost';

    // 2. DB에서 유저 조회
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('username', 'master_user')
      .single();

    if (userError || !user) {
      throw new Error('DB에서 master_user를 찾을 수 없습니다. users 테이블에 데이터가 들어있는지 확인하세요.');
    }

    // 3. 기존 등록된 패스키 조회
    const { data: passkeys } = await supabase
      .from('passkeys')
      .select('credential_id')
      .eq('user_id', user.id);

    // 4. 질문(Challenge) 생성
    // 주의: v9 라이브러리 규칙에 맞춰 userID를 문자열이 아닌 Buffer로 변환해서 넘깁니다.
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: Buffer.from(user.id, 'utf-8'), // <- 수정된 핵심 부분
      userName: user.username,
      excludeCredentials: passkeys?.map(key => ({
        id: key.credential_id,
        type: 'public-key'
      })) || [],
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
      }
    });

    // 5. DB에 질문 저장
    const { error: insertError } = await supabase.from('auth_challenges').insert({
      user_id: user.id,
      challenge: options.challenge,
      type: 'registration'
    });

    if (insertError) {
      throw new Error('Challenge 저장 실패: ' + insertError.message);
    }

    res.status(200).json(options);

  } catch (error) {
    // 500 에러 발생 시 Vercel 로그에 상세 에러를 찍고 프론트로 에러 메시지 반환
    console.error('API 내부 에러 발생:', error.message);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Portfolio Interactive Scripts (js/script.js)
 * Pure Vanilla JavaScript — Topology Showcase Explorer, Compact Project Modal,
 * Lightbox Zoom, Metric Counter, Dual Dropdown Navigation & Smooth Interactions
 */

document.addEventListener('DOMContentLoaded', () => {
  const navbar = document.getElementById('navbar');
  const scrollProgress = document.getElementById('scroll-progress');
  const logoBtn = document.getElementById('logo-btn');

  const modal = document.getElementById('detail-modal');
  const modalTag = document.getElementById('modal-project-tag');
  const modalTitle = document.getElementById('modal-project-title');
  const modalSarS = document.getElementById('modal-sar-s');
  const modalSarA = document.getElementById('modal-sar-a');
  const modalSarR = document.getElementById('modal-sar-r');
  const modalSpecsSection = document.getElementById('modal-specs-section');
  const modalSpecs = document.getElementById('modal-specs-block');
  const modalActions = document.getElementById('modal-actions-row');
  const modalClose = document.getElementById('detail-modal-close');
  const modalBackdrop = document.getElementById('detail-modal-backdrop');

  const modalTopologyExplorer = document.getElementById('modal-topology-explorer');
  const modalSubmoduleTabs = document.getElementById('modal-submodule-tabs');
  const modalSubmoduleTitle = document.getElementById('modal-submodule-title');
  const modalSubmoduleDesc = document.getElementById('modal-submodule-desc');
  const modalSubmoduleTags = document.getElementById('modal-submodule-tags');
  const modalGalleryContainer = document.getElementById('modal-gallery-container');
  const modalWalkthroughBox = document.getElementById('modal-walkthrough-box');

  const lightboxOverlay = document.getElementById('lightbox-overlay');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const lightboxClose = document.getElementById('lightbox-close');

  let lastActiveElement = null;

  // 1. Lightbox helper
  const openLightbox = (src, caption) => {
    if (!lightboxOverlay || !lightboxImg) return;
    lightboxImg.src = src;
    lightboxImg.alt = caption || '확대 이미지';
    if (lightboxCaption) lightboxCaption.textContent = caption || '';
    lightboxOverlay.classList.add('open');
    lightboxOverlay.setAttribute('aria-hidden', 'false');
  };

  const closeLightbox = () => {
    if (!lightboxOverlay) return;
    lightboxOverlay.classList.remove('open');
    lightboxOverlay.setAttribute('aria-hidden', 'true');
  };

  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightboxOverlay) {
    lightboxOverlay.addEventListener('click', (e) => {
      if (e.target === lightboxOverlay) closeLightbox();
    });
  }

  // Delegate image clicks inside modal walkthrough or gallery
  document.addEventListener('click', (e) => {
    const imgEl = e.target.closest('.modal-gallery-img-wrap img, .modal-walkthrough-box img');
    if (imgEl && imgEl.src) {
      openLightbox(imgEl.src, imgEl.alt || '');
    }
  });

  // 2. Smooth Scroll Navigation
  if (logoBtn) {
    logoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href').slice(1);
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({ behavior: 'smooth' });
        targetEl.setAttribute('tabindex', '-1');
        targetEl.focus({ preventScroll: true });
      }
    });
  });

  // 3. Scroll Reveal & Metric Count-Up Animation
  const animateMetricValue = (el) => {
    if (el.dataset.animated === 'true') return;
    el.dataset.animated = 'true';

    const target = parseInt(el.dataset.countTarget || '0', 10);
    const suffix = el.dataset.countSuffix || '';
    const format = el.dataset.countFormat || '';
    if (!target || document.body.classList.contains('reduce-motion')) {
      const formatted = format === 'comma' ? target.toLocaleString('ko-KR') : String(target);
      el.textContent = formatted + suffix;
      return;
    }

    const duration = 800;
    const startTime = performance.now();

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(target * eased);
      const formatted = format === 'comma' ? current.toLocaleString('ko-KR') : String(current);
      el.textContent = formatted + suffix;
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  };

  const revealElements = document.querySelectorAll('.reveal-on-scroll');
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          const metricVal = entry.target.querySelector('.metric-val[data-count-target]');
          if (metricVal) animateMetricValue(metricVal);
          revealObserver.unobserve(entry.target);
        }
      });
    }, { root: null, rootMargin: '0px 0px -6% 0px', threshold: 0.06 });

    revealElements.forEach((el) => revealObserver.observe(el));
  } else {
    revealElements.forEach((el) => el.classList.add('is-visible'));
  }

  // 4. KK-wonq 단계별 토폴로지 & 세부 모듈 데이터베이스
  // 큼지막한 토폴로지를 카드 전면에 보여주고, 상세보기 클릭 시 각 단계의 세부 수행 내역 전체를 탐색
  const topologyPhasesData = [
    {
      phaseKey: 'phase1',
      phaseBadge: 'PHASE 01 · FOUNDATION',
      title: 'GNS3 기초 폐쇄망 토폴로지 & NIDS/HIDS·NMS 구축',
      summary: '외부망(Outside)·DMZ·내부망(Inside)을 분리하고 HSRP 라우터 이중화, Cisco ASAv/Pfsense 방화벽, Snort/Suricata NIDS, OSSEC HIDS 및 Zabbix 관제를 단계별로 구축·검증했습니다.',
      topologyImg: 'port_images/default_GNS3_Topol.PNG',
      topologyCaption: 'Phase 1 기본 보안 네트워크 토폴로지 (ASAv · HSRP · Pfsense · Snort/OSSEC/Zabbix)',
      s: '<strong>상황 (Situation):</strong> 단일 네트워크 대역에서는 외부 침입 시 내부 서버로 위협이 즉각 확산되며, 라우터 단일 장애점(SPOF)과 호스트 변조를 실시간 식별하기 어려웠습니다.',
      a: '<strong>행동 (Action):</strong> GNS3에서 Cisco ASAv와 Pfsense로 구간별 보안 정책을 수립하고 HSRP 이중화를 구성했습니다. 이어 Snort·Suricata 커스텀 탐지 룰과 OSSEC(FIM)·Zabbix 모니터링을 연동했습니다.',
      r: '<strong>결과 (Result):</strong> 비인가 트래픽 차단, ICMP/HTTP/Port Scan/DDoS 공격 실시간 탐지, 윈도우·리눅스 에이전트 상태 통합 관제를 달성했습니다.',
      specs: `[Phase 1 토폴로지 핵심 구성]
• 방화벽 정책: Cisco ASAv (Inside 100 / DMZ 50 / Outside 0) & Pfsense NAT·HAProxy 로드밸런싱
• 가용성 확보: R3(Standby) · R4(Active) HSRP 가상 IP 기반 무중단 라우팅
• 침입 탐지(NIDS): Snort & Suricata local.rules 직접 작성 (ICMP, HTTP, SYN Port Scan, DDoS, 명령어 인젝션)
• 호스트/리소스 관제: OSSEC HIDS 무결성 검사(FIM) 및 Rocky Linux Zabbix 대시보드 시각화`,
      modules: [
        {
          id: 'p1_gns3',
          name: '1. GNS3 기본 토폴로지 & ASAv',
          title: 'GNS3 기본 토폴로지 및 Cisco ASAv 방화벽 규칙',
          desc: '폐쇄망 환경에서의 기초 보안 네트워크 설계, VLAN/OSPF 라우팅 및 ASAv ACL 정책 검증',
          tech: ['GNS3', 'Cisco ASAv', 'HSRP', 'VLAN/OSPF'],
          htmlContent: `
            <p>GNS3를 활용하여 가상 환경에서 폐쇄망을 구축했습니다. 외부망과 내부망을 분리하고, 그 사이에 방화벽을 두어 기본적인 보안 아키텍처를 설계했습니다.</p>
            <ul>
              <li><strong>Router &amp; Switch:</strong> Cisco 장비 VLAN 및 OSPF 라우팅, R3(Standby)·R4(Active) HSRP 이중화 설정</li>
              <li><strong>Firewall:</strong> 내부망 보호를 위한 ASAv 방화벽 배치 및 DMZ/Inside 접근 통제</li>
            </ul>
          `,
          images: [
            { src: 'port_images/default_GNS3_Topol.PNG', caption: '기본 네트워크 토폴로지 전체 구조' },
            { src: 'port_images/ASAv_rules.PNG', caption: '통합 ASAv 방화벽 룰 설정' },
            { src: 'port_images/FireFox3_to_inside_http.PNG', caption: '내부망(Inside)으로의 HTTP 접속 허용 검증' },
            { src: 'port_images/FireFox3_to_inside_telnet.PNG', caption: '내부망(Inside)으로의 Telnet 접속 허용 검증' },
            { src: 'port_images/PC1_to_webterm1_ping.PNG', caption: '외부망(Outside)에서 DMZ로의 ICMP 통신 확인' }
          ]
        },
        {
          id: 'p1_pfsense',
          name: '2. Pfsense 방화벽',
          title: '오픈소스 방화벽 Pfsense 구축 및 부하 분산',
          desc: 'WAN/LAN/DMZ 인터페이스 분리, 화이트리스트 정책 및 HAProxy 로드밸런싱',
          tech: ['Pfsense', 'Firewall', 'NAT', 'HAProxy'],
          htmlContent: `
            <p>Pfsense를 구축하여 기업망 수준의 보안 정책을 적용했습니다. WAN/LAN/DMZ 인터페이스 분리, 화이트리스트 기반 방화벽 정책 적용, 그리고 HAProxy를 이용한 웹 서버 부하 분산을 구현했습니다.</p>
          `,
          images: [
            { src: 'port_images/pfsense_remote_Access.PNG', caption: 'Pfsense 원격 접속 및 정책 관리 화면' }
          ]
        },
        {
          id: 'p1_snort',
          name: '3. Snort (NIDS) 룰셋',
          title: 'Snort (NIDS) 구축 및 커스텀 탐지 규칙 작성',
          desc: 'local.rules 직접 작성 후 ICMP, HTTP, SYN 포트 스캔, DDoS 공격 탐지 실습',
          tech: ['Snort', 'NIDS', 'Custom Rules'],
          htmlContent: `
            <p>Snort를 설치하고 직접 룰 파일(<code>local.rules</code>)을 작성하여 다양한 네트워크 공격을 실시간 탐지했습니다.</p>
            <ul>
              <li><strong>1. ICMP &amp; HTTP:</strong> 비정상적인 Ping 및 웹 요청 탐지</li>
              <li><strong>2. Port Scan:</strong> 단시간 내 다수의 접속 시도(Threshold) 탐지</li>
              <li><strong>3. DDoS 시도:</strong> SYN Flooding 공격 패턴 탐지</li>
            </ul>
          `,
          images: [
            { src: 'port_images/snort_rules_re_re.PNG', caption: '직접 작성한 Snort local.rules 파일' },
            { src: 'port_images/snortRule_1.PNG', caption: 'HTTP / ICMP 탐지 로그 확인' },
            { src: 'port_images/SnortRule_5_Kali.PNG', caption: 'Kali Linux SYN 포트 스캔 탐지' },
            { src: 'port_images/SnortRule_4.PNG', caption: 'DDoS 공격 패킷 실시간 탐지' }
          ]
        },
        {
          id: 'p1_suricata',
          name: '4. Suricata 고성능 NIDS',
          title: '멀티스레딩 기반 Suricata NIDS/IPS 구축',
          desc: 'Suricata 커스텀 룰셋 작성 및 SYN Flag 스캐닝·URL 명령어 실행 탐지',
          tech: ['Suricata', 'NIDS', 'IPS'],
          htmlContent: `
            <p>멀티스레딩을 지원하는 고성능 NIDS인 Suricata를 구축하고, SYN Flag 스캐닝 및 비정상 URL 명령어 실행 시도를 탐지하는 룰을 검증했습니다.</p>
          `,
          images: [
            { src: 'port_images/suricata_rules_re_re.PNG', caption: 'Suricata local.rules 설정 파일' },
            { src: 'port_images/SuricataRules_5.PNG', caption: 'SYN Flag 스캐닝 공격 탐지' },
            { src: 'port_images/suricata_rule4.PNG', caption: 'URL 명령어 인젝션 시도 탐지' }
          ]
        },
        {
          id: 'p1_ossec',
          name: '5. OSSEC (HIDS)',
          title: 'OSSEC 호스트 기반 침입 탐지(HIDS) 구축',
          desc: '서버 내부 파일 무결성 검사(FIM) 및 루트킷 탐지를 위한 에이전트 연동',
          tech: ['OSSEC', 'HIDS', 'FIM'],
          htmlContent: `
            <p>OSSEC 서버를 구축하고 Windows 10 및 Ubuntu 에이전트를 연동하여 주요 시스템 파일 변조(FIM) 및 비정상 로그온 이벤트를 감시했습니다.</p>
          `,
          images: [
            { src: 'port_images/OSSEC(HIDS)_ipaddr.PNG', caption: 'OSSEC 서버 네트워크 및 서비스 설정' },
            { src: 'port_images/Window10-Ossec.PNG', caption: 'Windows 10 OSSEC 에이전트 연동 확인' }
          ]
        },
        {
          id: 'p1_zabbix',
          name: '6. Zabbix 모니터링',
          title: 'Zabbix NMS 서버/네트워크 리소스 통합 모니터링',
          desc: 'Rocky Linux 기반 Zabbix 서버 구축 및 에이전트 트래픽·자원 시각화',
          tech: ['Zabbix', 'NMS', 'SNMP', 'Rocky Linux'],
          htmlContent: `
            <p>네트워크 관리 시스템(NMS) Zabbix를 구축하여 각 보안 장비와 서버의 CPU, 메모리, 트래픽 상태를 대시보드로 실시간 시각화했습니다.</p>
          `,
          images: [
            { src: 'port_images/Rocky_Zabbix_server.PNG', caption: 'Rocky Linux Zabbix 모니터링 대시보드' },
            { src: 'port_images/zabbix_link.PNG', caption: 'Zabbix 호스트 에이전트 연결 상태 확인' }
          ]
        }
      ]
    },
    {
      phaseKey: 'phase2',
      phaseBadge: 'PHASE 02 · INTEGRATION',
      title: '다층 방어(Defense in Depth) 통합 아키텍처 & 인프라 서비스 연동',
      summary: '방화벽(ASAv·Pfsense), IDS, Bind9 DNS, MariaDB, OpenVPN, Samba/NFS 파일 서버, 중앙 로그 분석기(Wazuh·PMM·LogAnalyzer)를 단일 토폴로지로 통합한 기업형 인프라입니다.',
      topologyImg: 'port_images/images-part/GNS3/topology.png',
      topologyCaption: 'Phase 2 다층 방어(Defense in Depth) 통합 네트워크 토폴로지',
      s: '<strong>상황 (Situation):</strong> 개별 보안 장비와 내부 서비스(DNS, DB, 스토리지, 원격 접속)가 분리되어 있을 경우 정책 충돌과 로그 분산으로 인해 침해사고 추적이 어렵습니다.',
      a: '<strong>행동 (Action):</strong> DMZ에 웹/DNS를, 내부망에 DB/로그/스토리지 서버를 배치해 ASAv·Pfsense·라우터 ACL로 통제하고, OpenVPN 터널링과 Rsyslog·LogAnalyzer·Wazuh·PMM 중앙 관제를 구축했습니다.',
      r: '<strong>결과 (Result):</strong> 외부 원격 접속부터 내부 스토리지 권한(ACL), 리눅스 보안 하드닝, 중앙 로그 수집까지 유기적으로 동작하는 통합 보안 망을 완성했습니다.',
      specs: `[Phase 2 통합 토폴로지 핵심 명세]
• 다층 방어(Defense in Depth): ASAv + Pfsense 이중 방화벽 및 라우터 ACL 정책 적용
• 내부 인프라 서비스: Bind9 DNS Zone 구성 및 도메인 기반 MariaDB 웹 연동
• 중앙 로그 & 관제: Rsyslog + LogAnalyzer 웹 분석, Wazuh SIEM 에이전트, PMM DB 모니터링
• 원격 접속 & 스토리지: Pfsense OpenVPN 암호화 터널링, Samba(ACL), NFS 마운트, Linux 보안 하드닝`,
      modules: [
        {
          id: 'p2_topology',
          name: '1. 통합 보안 토폴로지',
          title: 'Phase 2 통합 보안 아키텍처 & 방화벽/라우터 정책',
          desc: '방화벽, IDS, DB, 로그 서버가 모두 연동된 다층 방어 통합망 구성 및 트래픽 검증',
          tech: ['GNS3', 'Defense in Depth', 'ASAv', 'Pfsense'],
          htmlContent: `
            <p>개별적으로 구축했던 장비들을 하나의 토폴로지로 통합하여 <strong>다층 방어(Defense in Depth)</strong> 구조를 완성했습니다. DMZ에는 웹/DNS, 내부망(Inside)에는 DB/로그 서버를 배치하고 방화벽 및 라우터 ACL 정책으로 엄격히 통제했습니다.</p>
          `,
          images: [
            { src: 'port_images/images-part/GNS3/topology.png', caption: 'Phase 2 통합 보안 토폴로지 구조도' },
            { src: 'port_images/images-part/GNS3/AsaVrule.png', caption: '통합 ASAv 방화벽 정책 설정' },
            { src: 'port_images/images-part/GNS3/pfrule.png', caption: 'Pfsense 방화벽 룰 정책' },
            { src: 'port_images/images-part/GNS3/PC7-R3_ping.png', caption: 'PC7 -> Inside HTTPS 접속 검증' },
            { src: 'port_images/images-part/GNS3/DVWA-inside_telnet.png', caption: 'PC7 -> Inside Telnet 접속 검증' },
            { src: 'port_images/images-part/GNS3/R3-rule.png', caption: 'R3 라우터 ACL 정책 적용' },
            { src: 'port_images/images-part/GNS3/R2-Kali_SSH.png', caption: '라우터 정책: R2 -> Kali SSH 접속 확인' }
          ]
        },
        {
          id: 'p2_dns_db',
          name: '2. DNS & MariaDB',
          title: '내부망 Bind9 DNS 및 MariaDB 데이터베이스 연동',
          desc: '도메인 영역(Zone) 설정 및 데이터베이스 연동 웹 서비스 구축',
          tech: ['Bind9', 'MariaDB', 'DNS Zone', 'Linux'],
          htmlContent: `
            <p>내부망 서비스를 위한 Bind9 DNS 서버의 정방향/역방향 Zone을 설정하고, 도메인 질의를 통해 MariaDB가 연동된 웹 페이지가 정상 호출되도록 구현했습니다.</p>
          `,
          images: [
            { src: 'port_images/images-part/DNS,LOG,ANAlyzer,DB/DNS_Zone.png', caption: 'Bind9 DNS Zone 설정 화면' },
            { src: 'port_images/images-part/DNS,LOG,ANAlyzer,DB/domain-db.png', caption: 'DNS 도메인으로 DB 연동 페이지 접속 확인' }
          ]
        },
        {
          id: 'p2_log',
          name: '3. 중앙 로그·Wazuh·PMM',
          title: '중앙 로그 분석 시스템 (LogAnalyzer · Wazuh · PMM)',
          desc: '각 서버(Web, DB, FW)의 Syslog 중앙 수집 및 실시간 대시보드 관제',
          tech: ['Rsyslog', 'LogAnalyzer', 'Wazuh', 'PMM'],
          htmlContent: `
            <p>각 서버(Web, DB, FW)에서 발생하는 Syslog를 중앙 서버로 전송하도록 설정하고, LogAnalyzer 웹 인터페이스를 통해 효율적으로 분석할 수 있는 환경을 구축했습니다. 또한 Wazuh와 PMM을 추가 구축하여 에이전트 로그와 DB 성능을 실시간으로 감시했습니다.</p>
          `,
          images: [
            { src: 'port_images/images-part/DNS,LOG,ANAlyzer,DB/loganalyzer.png', caption: 'LogAnalyzer 중앙 Syslog 웹 분석 화면' },
            { src: 'port_images/images-part/wazuh.PNG', caption: 'Wazuh 에이전트 연결 및 보안 이벤트 대시보드' },
            { src: 'port_images/images-part/PMM.png', caption: 'PMM 데이터베이스 모니터링 대시보드' }
          ]
        },
        {
          id: 'p2_vpn',
          name: '4. OpenVPN 원격 접속',
          title: 'Pfsense OpenVPN 기반 안전한 원격 접속 터널링',
          desc: '외부망(Outside)에서 내부망 자원으로 암호화 터널을 통해 안전하게 접속',
          tech: ['OpenVPN', 'Pfsense', 'VPN Tunneling'],
          htmlContent: `
            <p>외부 근무자 환경에서 내부망 자원에 안전하게 접근할 수 있도록 Pfsense 기반 OpenVPN 서버와 인증서를 구성하고 원격 터널링 접속을 검증했습니다.</p>
          `,
          images: [
            { src: 'port_images/images-part/VPN/Pfsense.png', caption: 'Pfsense OpenVPN 서버 설정' },
            { src: 'port_images/images-part/VPN/access-remote.png', caption: 'OpenVPN 클라이언트 연결 및 내부망 접속 성공' }
          ]
        },
        {
          id: 'p2_samba',
          name: '5. Samba 파일 서버',
          title: 'Samba 이기종(Windows-Linux) 파일 공유 및 ACL 통제',
          desc: '사용자·그룹별 공유 폴더 접근 권한 설정 및 인증 검증',
          tech: ['Samba', 'File Server', 'Access Control'],
          htmlContent: `
            <p>Windows와 Linux 시스템 간 안전한 파일 공유를 위해 Samba 서버를 구축하고, 허가된 계정만 접근할 수 있도록 사용자 권한을 설정했습니다.</p>
          `,
          images: [
            { src: 'port_images/images-part/Samba,nfs/sambaserver.png', caption: 'Samba 권한 설정 후 Windows에서 공유 폴더 접근' }
          ]
        },
        {
          id: 'p2_nfs',
          name: '6. NFS 스토리지 공유',
          title: 'Linux 서버 간 고속 스토리지 공유를 위한 NFS 구축',
          desc: '/etc/exports 권한 설정 및 클라이언트 마운트 검증',
          tech: ['NFS', 'Linux Storage', 'Mount'],
          htmlContent: `
            <p>리눅스 서버 간 데이터 동기화를 위해 NFS 서버를 구성하고, 허용된 대역의 클라이언트에서만 디렉터리를 마운트할 수 있도록 제한했습니다.</p>
          `,
          images: [
            { src: 'port_images/images-part/Samba,nfs/nfs-mount.png', caption: '클라이언트 NFS 마운트 상태 확인' },
            { src: 'port_images/images-part/Samba,nfs/nfs-server.png', caption: 'NFS 서버 공유 디렉터리 설정 확인' }
          ]
        },
        {
          id: 'p2_linux_sec',
          name: '7. Linux 보안 하드닝',
          title: 'Linux 서버 보안 하드닝 및 권한 상승·로그 점검',
          desc: 'SetUID Bit 권한 상승 원리 분석, 계정 관리 및 wtmp/btmp 로그인 감사',
          tech: ['Linux Hardening', 'SetUID', 'Log Audit'],
          htmlContent: `
            <p>서버 보안 강화를 위해 불필요한 SetUID 파일 점검 및 권한 상승 실습을 수행하고, 로그인 성공/실패 기록(utmp, wtmp, btmp)을 분석하여 비정상 접근을 추적했습니다.</p>
          `,
          images: [
            { src: 'port_images/images-part/Linux/linux4.PNG', caption: 'SetUID Bit를 이용한 권한 상승 메커니즘 분석 실습' },
            { src: 'port_images/images-part/Linux/linux-3.png', caption: '로그인 성공/실패 감사 기록 확인 (1)' },
            { src: 'port_images/images-part/Linux/linux3-2.PNG', caption: '로그인 성공/실패 감사 기록 확인 (2)' }
          ]
        }
      ]
    },
    {
      phaseKey: 'phase3',
      phaseBadge: 'PHASE 03 · ANALYSIS & HACKING',
      title: 'Full-Security Labs 심화 토폴로지 · SIEM 관제 · 웹 해킹 & 악성코드 리버싱',
      summary: '공격자 그룹(Attacker A~D)과 내부 보안 연구실(Flare-VM, Wargame, Vulnhub, Juice Shop, Wazuh/GoAccess/PMM)을 경계 방화벽·NIPS로 분리한 심화 토폴로지 위에서 공격과 방어·리버싱을 수행했습니다.',
      topologyImg: 'part2-image/GNS3/topology.png',
      topologyCaption: 'Phase 3 Full-Security Labs 심화 토폴로지 (내부 보안 랩 192.168.0.0/16 ↔ 외부 공격망 10.10.10.0/24)',
      s: '<strong>상황 (Situation):</strong> 고도화된 웹 해킹(OWASP Top 10), 컨테이너 탈출(Docker Escape), 자격증명 탈취 악성코드(Mimikatz)의 실제 동작 원리를 파악해야 정교한 탐지 룰과 방어 대책을 수립할 수 있습니다.',
      a: '<strong>행동 (Action):</strong> Full-Security Labs 토폴로지를 구축하고 Wazuh·GoAccess·PMM으로 관제하면서, Juice Shop 웹 해킹, Vulnhub Venus(CVE-2021-3156) 및 Bluemoon(Docker Escape) 침투, IDA Pro/x64dbg 기반 Mimikatz SSP 리버싱을 수행했습니다.',
      r: '<strong>결과 (Result):</strong> 네트워크·웹·시스템·악성코드 전 영역의 공격 체인과 메모리/로그 흔적을 규명하여 공격자 관점과 관제 관점을 아우르는 분석 역량을 확보했습니다.',
      specs: `[Phase 3 심화 토폴로지 & 침투·리버싱 명세]
• 망 구성: VLAN 10(Network), VLAN 20(System), VLAN 30(Pentest) 분리 및 ASAv 5대 핵심 룰 + NIPS 배치
• SIEM & 웹 로그 관제: Wazuh 이벤트 대시보드 + GoAccess 실시간 WAF/웹 로그 분석 + PMM 연동
• 웹/시스템 침투: OWASP Juice Shop (SQLi, DOM XSS, Chatbot Logic Flaw), CVE-2021-3156, Docker Escape
• 악성코드 리버싱: Flare-VM 환경에서 Mimikatz(mimilib.dll) SpLsaModeInitialize SSP 등록 및 평문 로깅 함수 추적`,
      modules: [
        {
          id: 'p3_topology',
          name: '1. Full-Security 토폴로지',
          title: 'Phase 3 고도화 보안 토폴로지 설계 및 ASAv 룰 검증',
          desc: 'VLAN 대역 분리(Network/System/Pentest) 및 NIPS·ASAv 5대 방화벽 룰 적용',
          tech: ['GNS3', 'VLAN', 'ASAv', 'NIPS'],
          htmlContent: `
            <p>내부망(192.168.0.0/16)과 외부 공격망(10.10.10.0/24) 사이에 ASAv 방화벽과 Snort/Suricata NIPS를 배치하고, 리버싱(Flare-VM)·CTF·웹해킹(Juice Shop)·관제(Wazuh/PMM/GoAccess) 서버를 통합 구성했습니다.</p>
          `,
          images: [
            { src: 'part2-image/GNS3/topology.png', caption: 'Phase 3 Full-Security Labs 심화 통합 토폴로지' },
            { src: 'part2-image/GNS3/AC-ping.png', caption: 'VLAN 설정 후 구간별 Ping 통신 확인' },
            { src: 'part2-image/GNS3/asav-rule1.png', caption: 'ASAv 방화벽 세부 룰 작성 (1)' },
            { src: 'part2-image/GNS3/rule2.png', caption: 'ASAv 방화벽 세부 룰 작성 (2)' },
            { src: 'part2-image/GNS3/rule3.png', caption: 'ASAv 방화벽 세부 룰 작성 (3)' }
          ]
        },
        {
          id: 'p3_wazuh',
          name: '2. SIEM 통합 관제',
          title: 'Wazuh SIEM · GoAccess WAF · PMM 통합 보안 관제',
          desc: '오픈소스 SIEM과 실시간 웹 로그 분석기를 결합한 다각도 이벤트 모니터링',
          tech: ['Wazuh', 'SIEM', 'GoAccess', 'PMM', 'WAF'],
          htmlContent: `
            <p>Wazuh SIEM으로 호스트 및 네트워크 보안 이벤트를 수집하고, GoAccess를 통해 웹 서버/WAF 실시간 접속 및 공격 트래픽을 터미널과 대시보드에서 동시에 관제했습니다.</p>
          `,
          images: [
            { src: 'part2-image/wazuh,go,pmm/nail.png', caption: '통합 로그 분석 아키텍처 개요' },
            { src: 'part2-image/wazuh,go,pmm/wazuh-1.png', caption: 'Wazuh SIEM 보안 이벤트 대시보드' },
            { src: 'part2-image/wazuh,go,pmm/wazuh-2.png', caption: 'Wazuh 에이전트 연결 상태 관리' },
            { src: 'part2-image/wazuh,go,pmm/go-1.png', caption: 'GoAccess 실시간 터미널 로그 분석' },
            { src: 'part2-image/wazuh,go,pmm/go-2.png', caption: 'GoAccess 웹 대시보드 시각화' },
            { src: 'part2-image/wazuh,go,pmm/pmm.png', caption: 'PMM 데이터베이스 성능 및 쿼리 관제' }
          ]
        },
        {
          id: 'p3_juice',
          name: '3. OWASP Juice Shop 해킹',
          title: 'OWASP Juice Shop 웹 취약점 공격 실습 (SQLi · DOM XSS · Logic Flaw)',
          desc: '관리자 인증 우회, DOM 기반 XSS, 챗봇 프로세스 무력화(Process Null) 분석',
          tech: ['OWASP Top 10', 'Burp Suite', 'SQL Injection', 'DOM XSS'],
          htmlContent: `
            <h4>1. SQL Injection (Login Admin 우회)</h4>
            <p>로그인 폼에 <code>' OR 1=1 --</code> 구문을 삽입하여 비밀번호 검증 없이 관리자(Admin) 계정으로 우회 로그인에 성공했습니다.</p>
            <img src="part2-image/Juicy/login-admin/1-2.png" alt="SQL Injection 페이로드 입력">
            <img src="part2-image/Juicy/login-admin/1-3.png" alt="관리자 계정 로그인 성공">

            <h4>2. DOM XSS (검색창 스크립트 실행)</h4>
            <p>검색창(Search) 입력값이 DOM에 그대로 반영되는 취약점을 이용해 스크립트 태그를 삽입하고 브라우저 내 임의 코드 실행을 검증했습니다.</p>
            <img src="part2-image/Juicy/dom/7-2.png" alt="DOM XSS 페이로드 삽입">
            <img src="part2-image/Juicy/dom/7-3.png" alt="DOM XSS 알림창 실행 확인">

            <h4>3. Kill Chatbot (오픈소스 컴포넌트 로직 취약점 공략)</h4>
            <p>고객문의 챗봇(<code>juicy-chat-bot</code>)의 GitHub 공개 소스코드를 분석하여 입력 문자열이 내부 함수 인자로 처리되는 취약점을 확인했습니다. <code>admin"); process=null; users.addUser("1337", "test</code> 구문을 전송해 프로세스를 <code>null</code>로 덮어써 챗봇을 영구 비활성화했습니다.</p>
            <img src="part2-image/Juicy/kill/9-2.png" alt="챗봇 인터페이스 분석">
            <img src="part2-image/Juicy/kill/9-5.png" alt="juicy-chat-bot 소스코드 취약점 확인">
          `,
          images: [
            { src: 'part2-image/Juicy/juicy-nail.png', caption: 'OWASP Juice Shop 실습 메인' },
            { src: 'part2-image/Juicy/login-admin/1-1.png', caption: 'SQL Injection 실습 요약' },
            { src: 'part2-image/Juicy/dom/7-1.png', caption: 'DOM XSS 실습 요약' },
            { src: 'part2-image/Juicy/kill/9-1.png', caption: 'Kill Chatbot 로직 취약점 요약' }
          ]
        },
        {
          id: 'p3_malware',
          name: '4. 악성코드 분석 (Mimikatz)',
          title: 'Flare-VM 환경에서의 Mimikatz(mimilib.dll) SSP 인젝션 상세 리버싱',
          desc: 'PEstudio 정적 분석, IDA Pro 디스어셈블리 추적 및 Process Monitor 동적 분석',
          tech: ['Reverse Engineering', 'IDA Pro', 'PEstudio', 'Flare-VM'],
          htmlContent: `
            <h4>1. 샘플 악성코드(mimilib.dll) 개요</h4>
            <p>보안 지원 공급자(SSP)로 위장하여 Windows LSA(Local Security Authority) 프로세스에 등록되는 악성 DLL입니다. 등록 이후 시스템에 로그인하는 사용자의 평문 비밀번호를 가로채 로그 파일(예: <code>mimilsa.log</code>)에 기록합니다.</p>

            <h4>2. PEstudio 정적 분석</h4>
            <p>Export 함수 목록에서 <code>SpLsaModeInitialize</code>(LSA 시작 시 SSP 등록), <code>PasswordChangeNotify</code> / <code>NPLogonNotify</code>(비밀번호 변경 및 네트워크 로그온 이벤트 후킹) 함수를 확인했습니다.</p>
            <img src="part2-image/flare-vm/1.png" alt="PEstudio Export 함수 분석">

            <h4>3. IDA Pro를 통한 SpLsaModeInitialize 및 자격증명 복호화 추적</h4>
            <p><code>SpLsaModeInitialize</code> 진입점부터 보안 쿠키 참조, <code>LoadLibraryW</code> 및 <code>GetProcAddress</code>를 통한 <code>advapi32.dll</code> 내 <code>CredIsProtectedW</code> / <code>CredUnprotectW</code> 동적 호출 루틴을 역추적했습니다.</p>
            <img src="part2-image/flare-vm/2.png" alt="IDA SpLsaModeInitialize Export 확인">
            <img src="part2-image/flare-vm/5.png" alt="GetProcAddress 동적 API 호출 추적">
            <img src="part2-image/flare-vm/7.png" alt="자격증명 복호화 루틴 디컴파일 분석">

            <h4>4. 평문 비밀번호 파일 기록 함수(sub_180004B30) 규명</h4>
            <p>복호화된 자격증명 평문 데이터를 쓰기 모드로 연 로그 파일 스트림에 <code>vfwprintf</code>로 기록하고 <code>fflush</code>로 즉시 디스크에 저장하는 내부 함수를 확인했습니다.</p>
            <img src="part2-image/flare-vm/8.png" alt="로그 파일 오픈 및 기록 분기문">
            <img src="part2-image/flare-vm/9.png" alt="vfwprintf 및 fflush 호출 확인">

            <h4>5. Process Monitor 동적 실행 검증</h4>
            <p><code>rundll32.exe</code>로 실행한 뒤 Process Monitor에서 프로세스 행위와 필터 로그 생성 여부를 동적으로 검증했습니다.</p>
            <img src="part2-image/flare-vm/10.png" alt="rundll32 실행 및 Process Monitor 캡처 (1)">
            <img src="part2-image/flare-vm/11.png" alt="Process Monitor 동적 행위 분석 (2)">
          `,
          images: [
            { src: 'part2-image/flare-vm/flare_nail.png', caption: 'Mimikatz mimilib.dll 리버싱 프로젝트' }
          ]
        },
        {
          id: 'p3_venus',
          name: '5. CTF - Vulnhub Venus',
          title: 'CTF Vulnhub Venus: 패킷 캡처 및 Sudo 취약점(CVE-2021-3156) Root 탈취',
          desc: 'Nmap 포트 스캔, SSH 침투 후 패킷 분석 및 Baron Samedit 취약점 권한 상승',
          tech: ['Penetration Test', 'CVE-2021-3156', 'Nmap', 'Privilege Escalation'],
          htmlContent: `
            <h4>1. 환경 분석 및 초기 침투</h4>
            <p>Nmap 스캔을 통해 22(SSH), 80(HTTP) 포트 오픈을 확인하고 초기 침투 후 User Flag를 획득했습니다.</p>
            <img src="port_images/images-part/ctf/ctf-nmap.png" alt="Nmap 포트 스캔 결과">
            <img src="port_images/images-part/ctf/userflag.png" alt="User Flag 획득">

            <h4>2. Sudo 취약점(CVE-2021-3156) 악용 및 Root 권한 획득</h4>
            <p>내부 패킷 캡처로 추가 자격 증명을 확보한 뒤, Sudo 힙 기반 버퍼 오버플로우 취약점(CVE-2021-3156)을 공략하여 최종 Root 권한과 Flag를 획득했습니다.</p>
            <img src="port_images/images-part/ctf/CVE.png" alt="CVE-2021-3156 익스플로잇 실행">
            <img src="port_images/images-part/ctf/rootflag.png" alt="Root Flag 획득 완료">
          `,
          images: [
            { src: 'port_images/images-part/ctf/venus.jpg', caption: 'Vulnhub Venus 워게임' }
          ]
        },
        {
          id: 'p3_bluemoon',
          name: '6. CTF - Bluemoon Docker',
          title: 'CTF Bluemoon: FTP/Hydra 공략 및 Docker Container Escape 권한 상승',
          desc: '포트 스캐닝, Hydra 사전 대입 공격 및 Docker Alpine 컨테이너 이스케이프 실습',
          tech: ['Docker Escape', 'Hydra', 'FTP/SSH Exploit', 'Linux'],
          htmlContent: `
            <h4>1. 포트 스캔 및 계정 탈취</h4>
            <p>Nmap으로 21(FTP), 22(SSH), 80(HTTP) 오픈을 확인한 뒤 취약점을 통해 사용자명을 파악하고, Hydra 패스워드 크래킹으로 SSH 접속 비밀번호를 획득했습니다.</p>
            <img src="part2-image/ctf/3.png" alt="Bluemoon Nmap 스캔">
            <img src="part2-image/ctf/12.png" alt="Hydra SSH 패스워드 크래킹">
            <img src="part2-image/ctf/13.png" alt="SSH 로그인 성공">

            <h4>2. Docker Container Escape를 통한 Root Flag 획득</h4>
            <p>User Flag 획득 후, 취약한 실행 파일과 Docker Alpine 컨테이너 마운트 권한을 악용해 호스트 루트 파일시스템에 접근(Container Escape)하여 최종 Root Flag를 획득했습니다.</p>
            <img src="part2-image/ctf/14.png" alt="User Flag 확인">
            <img src="part2-image/ctf/20.png" alt="Docker Alpine을 이용한 Root Flag 획득">
          `,
          images: [
            { src: 'part2-image/ctf/bluemoon.png', caption: 'Bluemoon Docker Escape 풀이' }
          ]
        }
      ]
    },
    {
      phaseKey: 'phase4',
      phaseBadge: 'PHASE 04 · TEAM PROJECT & WARGAME',
      title: '가상 커머스 "장보고마켓" 3계층 보안 아키텍처 · WAF/Splunk 관제 & CTF/Wargame 제작',
      summary: '팀장으로서 가상 전자상거래 서비스를 풀스택 구현하고, 외부망-보안망(pfSense·Suricata·ModSecurity WAF)-내부망(Web/DB)-관제망(rSyslog·ELK·Wazuh·Splunk) 아키텍처 설계 및 자체 CTF/워게임 구축을 주도했습니다.',
      topologyImg: 'part3-image/hack/hacking_3.png',
      topologyCaption: 'Phase 4 가상 커머스 "장보고마켓" 3계층 보안망 및 SIEM(Splunk·Wazuh·ELK) 관제 아키텍처',
      s: '<strong>상황 (Situation):</strong> 실제 웹·모바일 전자상거래 환경에서 발생하는 복합 공격(CSRF, XSS, Blind SQLi, 세션 탈취, 명령어 인젝션)을 방어하고 실시간 시각화할 실무형 통합 보안 아키텍처가 필요했습니다.',
      a: '<strong>행동 (Action):</strong> 팀장으로서 프론트/백엔드 개발과 3계층 보안 아키텍처를 설계하고, ModSecurity WAF 커스텀 룰(Origin/Referer 검증)과 Docker 기반 Splunk Forwarder 실시간 위협 대시보드를 구축했습니다. 또한 직접 취약점을 설계한 CTF 및 5단계 Wargame(Password1234)을 제작·풀이했습니다.',
      r: '<strong>결과 (Result):</strong> 비정상 변조 요청 403 실시간 차단 및 Splunk 공격 유형별 통계 시각화를 완성하고, 6종의 상세 모의해킹·관제 결과 보고서(PDF)를 산출했습니다.',
      specs: `[Phase 4 팀 프로젝트 아키텍처 & 산출물 명세]
• 담당 역할 (팀장 이혜원): 일정 총괄, 웹/백엔드 구현, ModSecurity WAF 룰셋 설계, Docker Splunk 관제 구축
• 보안 아키텍처: 외부망(Web/Android) -> 경계 보안망(pfSense, Suricata, WAF) -> 내부망(Apache, MariaDB) + 보안 관제망(Splunk, Wazuh, ELK)
• WAF 방어 룰(Rule 10051~10053): 신뢰 도메인 검증 및 비정상 POST 요청 403 Forbidden 즉시 차단
• CTF & Wargame: Blind SQLi(search.php), SSH Key, UNION SQLi, Session Hijacking, Command Injection Time-based 풀이`,
      modules: [
        {
          id: 'p4_team_jangbogo',
          name: '1. 장보고마켓 보안 구축·관제',
          title: '가상 커머스 "장보고마켓" 보안 구축, WAF 차단 및 Splunk 통합 관제',
          desc: '팀장 수행: 3계층 보안 아키텍처 설계, CSRF 공격 시나리오 및 ModSecurity WAF 방어, Splunk 대시보드 구축',
          tech: ['Team Leader', 'ModSecurity WAF', 'Splunk', 'Suricata', 'ELK/Wazuh', 'Docker'],
          downloads: [
            { name: '보안 취약점 정리(웹&모바일) 보고서 (PDF)', src: 'part3-image/hack/document/보안_취약점_정리(웹&모바일).pdf' },
            { name: '웹&모바일 취약점 공격 및 탐지 보고서 (PDF)', src: 'part3-image/hack/document/웹_취약점_공격_및_탐지.pdf' },
            { name: 'Splunk 로그 구축 보고서 (PDF)', src: 'part3-image/hack/document/Splunk_로그_구축_이야기.pdf' },
            { name: '팀 프로젝트 모의해킹 전체 보고서 (PDF)', src: 'part3-image/hack/document/팀패스워드_모의해킹_보고서.pdf' }
          ],
          htmlContent: `
            <h4>1. 프로젝트 개요 및 담당 역할 (팀장 이혜원)</h4>
            <p>가상 전자상거래 서비스 <strong>"장보고마켓"</strong>을 직접 구축하고, 실제 공격 시나리오를 기반으로 취약점을 진단 및 방어하는 팀 프로젝트를 주도했습니다. 전체 일정 관리, Frontend/Backend 구현, ModSecurity WAF 정책 수립 및 Splunk 관제 시스템 구축을 담당했습니다.</p>
            <img src="part3-image/hack/hacking_2.png" alt="장보고마켓 프로젝트 개요">
            <img src="part3-image/hack/hacking_1.png" alt="팀원 역할 분담 및 소개">

            <h4>2. 대상 시스템 3계층 보안 아키텍처</h4>
            <p>외부망(Web/Mobile)에서 방화벽(pfSense), IDS/IPS(Suricata), WAF(ModSecurity)를 거쳐 내부망(Web/DB)으로 접근하는 다층 보안 아키텍처를 설계하고, 별도 보안 관제망에 rSyslog, ELK Stack, Wazuh, Splunk를 배치해 이벤트 로그를 중앙 집중화했습니다.</p>
            <img src="part3-image/hack/hacking_3.png" alt="장보고마켓 시스템 아키텍처 구성도">

            <h4>3. 주요 취약점 분석 및 WAF 방어: CSRF (Cross-Site Request Forgery)</h4>
            <p>관리자나 일반 사용자가 의도치 않게 상품 정보를 수정하도록 유도하는 자동 전송 폼(<code>document.attackForm.submit()</code>) 공격 시나리오를 구성하고, 이를 ModSecurity WAF의 <code>Referer</code> / <code>Origin</code> 헤더 화이트리스트 검증 룰(Rule 10051~10053)로 방어하여 <strong>403 Forbidden</strong> 차단 및 감사 로그(<code>CSRF Attack Detected</code>) 기록을 검증했습니다.</p>
            <img src="part3-image/hack/csrf1.png" alt="CSRF 자동 제출 공격 스크립트">
            <img src="part3-image/hack/csrf-waf.png" alt="ModSecurity CSRF 방어 커스텀 룰 설정">
            <img src="part3-image/hack/csrf3.png" alt="WAF CSRF Attack Detected 감사 로그">
            <img src="part3-image/hack/csrf2.png" alt="403 Forbidden 공격 차단 화면">

            <h4>4. Docker 기반 Splunk 실시간 위협 관제 대시보드 구축</h4>
            <p>Ubuntu 서버에 Docker 컨테이너로 Splunk Enterprise를 구축하고, Rocky Linux 웹 서버에 Universal Forwarder를 설치(<code>./splunk add monitor</code>)하여 WAF 감사 로그(<code>modsec_audit.log</code>)를 실시간 수집했습니다. 정규표현식(Rex) 필드 파싱과 SPL 쿼리로 공격 유형별 탐지 통계를 시각화했습니다.</p>
            <img src="part3-image/hack/splunk2.png" alt="Splunk Universal Forwarder 설치">
            <img src="part3-image/hack/splunk3.png" alt="WAF 로그 모니터링 포워딩 등록">
            <img src="part3-image/hack/splunk5.png" alt="Splunk 공격 유형별 실시간 탐지 통계">
          `,
          images: [
            { src: 'part3-image/hack/hacking_3.png', caption: '장보고마켓 3계층 보안 및 관제 아키텍처' },
            { src: 'part3-image/hack/csrf-waf.png', caption: 'ModSecurity WAF 커스텀 룰셋' },
            { src: 'part3-image/hack/splunk5.png', caption: 'Splunk 위협 탐지 대시보드' }
          ]
        },
        {
          id: 'p4_ctf_web',
          name: '2. CTF 제작 (Blind SQLi)',
          title: '팀 프로젝트 자체 제작 CTF: 퍼징 및 Blind SQL Injection 공략',
          desc: '직접 취약점을 설계한 로그인/검색 페이지에서 Gobuster·Fuzzing·SQLmap을 통한 관리자 탈취',
          tech: ['CTF Design', 'Gobuster', 'Parameter Fuzzing', 'Blind SQLi', 'SQLmap'],
          downloads: [
            { name: 'CTF 전체 워크스루 보고서 (PDF)', src: 'part3-image/ctf/팀_프로젝트_풀이과정(CTF).pdf' },
            { name: 'Project VM (OVA) Google Drive ↗', src: 'https://drive.google.com/file/d/1qPtaBbjD_TA1BNAV04lhG9ebSwV3HZdq/view?usp=drive_link' }
          ],
          htmlContent: `
            <h4>1. 디렉터리 탐색 및 숨겨진 엔드포인트 식별</h4>
            <p>자체 제작 CTF에서 로그인 및 검색 취약점 설계 파트를 담당했습니다. 회원가입 후 관리자 전용 업로드 메뉴를 확인하고, <code>gobuster</code>를 이용해 숨겨진 <code>search.php</code> 파일을 찾아냈습니다.</p>
            <img src="part3-image/ctf/ctf-2.png" alt="회원가입 및 로그인 화면">
            <img src="part3-image/ctf/ctf-3.png" alt="관리자 전용 업로드 버튼 확인">
            <img src="part3-image/ctf/ctf-4.png" alt="Gobuster를 통한 search.php 탐색">

            <h4>2. 파라미터 퍼징(Fuzzing) 및 Blind SQL Injection 식별</h4>
            <p><code>search.php</code>의 응답 길이 필터링 퍼징을 수행하여 유효 파라미터 <code>q</code>를 찾아내고, 조건문 참/거짓에 따라 응답이 달라지는 Blind SQL Injection 취약점을 확인했습니다.</p>
            <img src="part3-image/ctf/ctf-7.png" alt="파라미터 퍼징 수행">
            <img src="part3-image/ctf/ctf-8.png" alt="유효 파라미터 q 도출">
            <img src="part3-image/ctf/ctf-11.png" alt="파라미터 q 입력 시 Blind SQLi 응답 확인">

            <h4>3. SQLmap 데이터베이스 덤프 및 Admin 탈취</h4>
            <p><code>sqlmap</code>으로 <code>website</code> 데이터베이스를 식별하고 <code>--dump</code> 옵션으로 관리자 계정 패스워드를 추출하여 최종 관리자 로그인에 성공했습니다.</p>
            <img src="part3-image/ctf/ctf-12.png" alt="SQLmap 데이터베이스 목록 추출">
            <img src="part3-image/ctf/ctf-13.png" alt="Admin 계정 크레덴셜 덤프">
            <img src="part3-image/ctf/ctf-14.png" alt="Admin 로그인 성공">
          `,
          images: [
            { src: 'part3-image/ctf/ctf-1.png', caption: '팀 프로젝트 CTF 메인 화면' }
          ]
        },
        {
          id: 'p3_wargame_pw1234',
          name: '3. Wargame: Password1234',
          title: 'Wargame (Password1234) 단계별(Easy~Very Hard) 침투 워크스루',
          desc: 'SSH 키 권한 악용, UNION SQLi, 쿠키 로그 기반 세션 하이재킹, Time-based Command Injection 풀이',
          tech: ['SSH Privilege', 'UNION SQLi', 'Session Hijacking', 'Command Injection'],
          downloads: [
            { name: 'Wargame 전체 워크스루 보고서 (PDF)', src: 'part3-image/wargame/password1234-wargame_워크스루.pdf' },
            { name: 'Wargame VM (OVA) Google Drive ↗', src: 'https://drive.google.com/file/d/1bsjcZof9CqIn9axXwGMUNPnVSR1yyLIC/view?usp=drive_link' }
          ],
          htmlContent: `
            <h4>Step 1. System Hacking — SSH 원격접속 권한 상승 (Level: Easy 2)</h4>
            <p><code>sudo -l</code>로 <code>playssh2</code> 권한의 <code>id_rsa</code> 열람 권한을 확인한 뒤 개인키를 추출하고, 쉘 즉시 종료 제한을 우회하기 위해 SSH 접속 명령 인자에 직접 <code>cat flag.txt</code>를 전달해 플래그를 획득했습니다.</p>
            <img src="part3-image/wargame/s2-2.png" alt="sudo -l 권한 확인 및 id_rsa 열람">
            <img src="part3-image/wargame/s2-6.png" alt="SSH 원격 명령 인자 전달로 Flag 획득">

            <h4>Step 2. Web Hacking — UNION SQL Injection (Level: Normal 2)</h4>
            <p>검색창에 작은따옴표(<code>'</code>)를 입력해 SQL 에러를 확인한 뒤, <code>UNION SELECT</code> 구문으로 숨겨진 <code>password</code> 컬럼 데이터를 추출하여 플래그를 획득했습니다.</p>
            <img src="part3-image/wargame/wnor-2.png" alt="SQL Fatal Error 확인">
            <img src="part3-image/wargame/wnor-5.png" alt="UNION SQLi로 password 컬럼 내 Flag 추출">

            <h4>Step 3. Web Hacking — Session Hijacking (Level: Hard 2)</h4>
            <p>Gobuster로 <code>Bot.php</code>와 <code>cookie_log.txt</code>를 찾아낸 뒤, 봇이 기록한 관리자 <code>sessionid</code> 값을 브라우저 개발자 도구 쿠키에 주입하여 Admin 세션 탈취에 성공했습니다.</p>
            <img src="part3-image/wargame/wh-2.png" alt="Gobuster로 숨겨진 파일 탐색">
            <img src="part3-image/wargame/wh-5.png" alt="cookie_log.txt 내 세션 ID 확보">
            <img src="part3-image/wargame/wh-7.png" alt="세션 하이재킹을 통한 Admin 마이페이지 접근">

            <h4>Step 4. Web Hacking — Time-based Command Injection (Level: Very Hard)</h4>
            <p>네트워크 핑 진단 도구에서 명령어 실행 결과가 화면에 직접 출력되지 않는 조건을 극복하기 위해, <code>8.8.8.8; cat /opt/ping_flag.txt | cut -c 1 | grep -x "F" &amp;&amp; sleep 5</code> 구문으로 응답 지연(5초) 여부를 판별하는 Blind Command Injection 기법으로 플래그를 완성했습니다.</p>
            <img src="part3-image/wargame/wvh-2.png" alt="페이지 소스에서 플래그 경로 힌트 확인">
            <img src="part3-image/wargame/wvh-3.png" alt="sleep 5 시간차 조건문을 통한 플래그 한글자씩 추출">
          `,
          images: [
            { src: 'part3-image/wargame/password1234-wargame.PNG', caption: 'Password1234 워게임 메인 대시보드' },
            { src: 'part3-image/wargame/seasy2.png', caption: 'SystemHacking - Easy 2' },
            { src: 'part3-image/wargame/wnormal2.png', caption: 'WebHacking - Normal 2 (SQLi)' },
            { src: 'part3-image/wargame/whard2.png', caption: 'WebHacking - Hard 2 (Session Hijacking)' },
            { src: 'part3-image/wargame/wveryhard1.png', caption: 'WebHacking - Very Hard (Command Injection)' }
          ]
        }
      ]
    }
  ];

  // 5. Render Topology Showcase Grid (큼지막한 토폴로지 우선 노출)
  const topologyGridEl = document.getElementById('topology-showcase-grid');
  const topologyTabBtns = document.querySelectorAll('.topology-tab-btn');

  const renderTopologyShowcase = (filterPhase = 'all') => {
    if (!topologyGridEl) return;
    topologyGridEl.innerHTML = '';

    const list = filterPhase === 'all'
      ? topologyPhasesData
      : topologyPhasesData.filter((item) => item.phaseKey === filterPhase);

    list.forEach((phase) => {
      const card = document.createElement('article');
      card.className = 'topology-card reveal-on-scroll is-visible';

      const subChipsHTML = phase.modules.map((mod, idx) => (
        `<button type="button" class="submodule-chip" data-open-phase="${phase.phaseKey}" data-open-idx="${idx}" title="${mod.title} 상세 보기">${mod.name}</button>`
      )).join('');

      card.innerHTML = `
        <div>
          <div class="topology-card-top-bar">
            <span class="topology-phase-pill">${phase.phaseBadge}</span>
            <span class="topology-zoom-hint">클릭하여 상세 실습 보기</span>
          </div>
          <div class="topology-visual-frame" data-open-phase="${phase.phaseKey}" data-open-idx="0" role="button" tabindex="0" aria-label="${phase.title} 토폴로지 및 상세 내역 열기">
            <img src="${phase.topologyImg}" alt="${phase.topologyCaption}" class="topology-visual-img" loading="lazy" />
          </div>
          <div class="topology-card-body">
            <div>
              <h3 class="topology-card-title">${phase.title}</h3>
              <p class="topology-card-summary">${phase.summary}</p>
              <div>
                <span class="topology-submodules-label">포함된 세부 프로젝트 (${phase.modules.length}개 · 클릭 시 바로 이동)</span>
                <div class="topology-submodules-list">
                  ${subChipsHTML}
                </div>
              </div>
            </div>
            <div class="topology-card-footer">
              <span class="topology-meta-count">토폴로지 구조도 + 세부 실습 ${phase.modules.length}건</span>
              <button type="button" class="btn-topology-detail" data-open-phase="${phase.phaseKey}" data-open-idx="0">
                <span>상세보기</span>
                <span class="arrow-icon" aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </div>
      `;

      topologyGridEl.appendChild(card);
    });
  };

  renderTopologyShowcase('all');

  topologyTabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      topologyTabBtns.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      renderTopologyShowcase(btn.dataset.phaseFilter || 'all');
    });
  });

  // Delegate clicks on topology cards, submodule chips, and detail buttons
  if (topologyGridEl) {
    topologyGridEl.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-open-phase]');
      if (!trigger) return;
      const phaseKey = trigger.getAttribute('data-open-phase');
      const modIdx = parseInt(trigger.getAttribute('data-open-idx') || '0', 10);
      openTopologyPhaseModal(phaseKey, modIdx);
    });

    topologyGridEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const trigger = e.target.closest('[data-open-phase]');
        if (!trigger) return;
        e.preventDefault();
        const phaseKey = trigger.getAttribute('data-open-phase');
        const modIdx = parseInt(trigger.getAttribute('data-open-idx') || '0', 10);
        openTopologyPhaseModal(phaseKey, modIdx);
      }
    });
  }

  // Render a specific submodule inside the Topology Modal
  const renderSubmoduleContent = (phase, moduleIndex) => {
    const mod = phase.modules[moduleIndex] || phase.modules[0];
    if (!mod) return;

    // Update active state on subtabs
    if (modalSubmoduleTabs) {
      modalSubmoduleTabs.querySelectorAll('.modal-subtab-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', idx === moduleIndex);
      });
    }

    if (modalSubmoduleTitle) modalSubmoduleTitle.textContent = mod.title;
    if (modalSubmoduleDesc) modalSubmoduleDesc.textContent = mod.desc;

    if (modalSubmoduleTags) {
      modalSubmoduleTags.innerHTML = (mod.tech || [])
        .map((t) => `<span class="compact-tech-tag">${t}</span>`)
        .join('');
    }

    // Render image gallery for the selected submodule
    if (modalGalleryContainer) {
      if (mod.images && mod.images.length > 0) {
        const isMulti = mod.images.length > 1;
        const itemsHTML = mod.images.map((img) => `
          <div class="modal-gallery-item">
            <div class="modal-gallery-img-wrap" title="클릭하여 원본 크기로 확대">
              <img src="${img.src}" alt="${img.caption}" class="modal-gallery-img" loading="lazy" />
            </div>
            <div class="modal-gallery-caption">${img.caption}</div>
          </div>
        `).join('');
        modalGalleryContainer.innerHTML = `<div class="modal-gallery-grid ${isMulti ? 'multi' : ''}">${itemsHTML}</div>`;
      } else {
        modalGalleryContainer.innerHTML = '';
      }
    }

    // Render detailed HTML walkthrough
    if (modalWalkthroughBox) {
      if (mod.htmlContent) {
        modalWalkthroughBox.innerHTML = mod.htmlContent;
        modalWalkthroughBox.style.display = 'flex';
      } else {
        modalWalkthroughBox.innerHTML = '';
        modalWalkthroughBox.style.display = 'none';
      }
    }

    // Render downloads/action buttons if present
    if (modalActions) {
      modalActions.innerHTML = '';
      if (mod.downloads && mod.downloads.length > 0) {
        mod.downloads.forEach((dl, idx) => {
          const a = document.createElement('a');
          a.href = dl.src;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.className = idx === 0 ? 'btn-editorial btn-editorial-primary' : 'btn-editorial';
          a.textContent = `📥 ${dl.name}`;
          modalActions.appendChild(a);
        });
      }
    }
  };

  const openTopologyPhaseModal = (phaseKey, initialModuleIdx = 0) => {
    if (!modal) return;
    const phase = topologyPhasesData.find((p) => p.phaseKey === phaseKey);
    if (!phase) return;

    lastActiveElement = document.activeElement;

    if (modalTag) modalTag.textContent = phase.phaseBadge;
    if (modalTitle) modalTitle.textContent = phase.title;
    if (modalSarS) modalSarS.innerHTML = phase.s;
    if (modalSarA) modalSarA.innerHTML = phase.a;
    if (modalSarR) modalSarR.innerHTML = phase.r;
    if (modalSpecs) modalSpecs.textContent = phase.specs;

    if (modalTopologyExplorer) {
      modalTopologyExplorer.classList.add('active');
    }

    if (modalSubmoduleTabs) {
      modalSubmoduleTabs.innerHTML = '';
      phase.modules.forEach((mod, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `modal-subtab-btn ${idx === initialModuleIdx ? 'active' : ''}`;
        btn.textContent = mod.name;
        btn.addEventListener('click', () => renderSubmoduleContent(phase, idx));
        modalSubmoduleTabs.appendChild(btn);
      });
    }

    renderSubmoduleContent(phase, initialModuleIdx);

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    if (modalClose) modalClose.focus();
  };

  // 6. Featured 3대 대표 웹 아키텍처 & 논문 상세 데이터
  const projectDetailsData = {
    ztna: {
      tag: 'FEATURED 01 · ZTNA & XDR SECURITY SUITE',
      title: 'ZTNA·XDR 통합 보안 웹 애플리케이션 아키텍처',
      s: '<strong>상황 (Situation):</strong> 단순 계정 로그인만으로는 비인가 기기 접근, 무차별 대입(Brute-force) 공격 및 권한 우회 API 호출을 방어하기 어려워 신원과 디바이스를 동시에 검증하는 제로트러스트(ZTNA) 및 침해 탐지·대응(XDR) 체계가 필요했습니다.',
      a: '<strong>행동 (Action):</strong> Supabase Auth JWKS 비대칭 키 서명 검증, 디바이스 고유 인가(/api/device), 허용 엔드포인트 화이트리스트 라우팅, 실시간 로그인 실패 횟수 기반 공격 차단 및 SAMPLE_NOTE_1 무결성 마커를 통한 안전한 복원(/api/restore) 파이프라인을 구축했습니다.',
      r: '<strong>결과 (Result):</strong> 비인가 경로 100% 차단과 공격 탐지·격리·데이터 무결성 복원 자동화를 검증하고 실제 클라우드 환경에 배포했습니다.',
      specs: `[ZTNA & XDR 아키텍처 핵심 명세]
• 인증/인가: Supabase /.well-known/jwks.json 기반 JWT 서명 & audience: "authenticated" 검증
• 디바이스 제어: 등록된 인가 기기 식별자에 한해 세션 발급 (/api/device)
• 접근 통제: POST /api/login, POST /api/device, /api/memos, POST /api/restore 외 비인가 경로 100% 차단
• XDR 위협 완화: 비정상 무차별 대입 공격 실시간 차단 및 데이터 변조 시 원클릭 무결성 복구`,
      actions: [
        { label: '배포 웹 애플리케이션 열기 ↗', url: 'https://choi-bujang-secret-vault-one-phi.vercel.app/', primary: true },
        { label: 'GitHub 저장소 ↗', url: 'https://github.com/wonq-Port/choi-bujang-secret-vault', primary: false }
      ]
    },

    phishing: {
      tag: 'FEATURED 02 · RESEARCH PAPER & LIVE WEB APP',
      title: '피싱 URL 형태학 분석 연구 논문 & 사전 진단기 웹앱',
      s: '<strong>상황 (Situation):</strong> 웹페이지 본문에 직접 접속해 분석하는 방식은 악성코드 감염 위험과 네트워크 지연이 발생하므로, 브라우저 접속 전 URL 문자열 구조만으로 위험도를 사전 판별할 통계적 근거와 진단 도구가 필요했습니다.',
      a: '<strong>행동 (Action):</strong> 110,077건 공개 보안 데이터셋에 대해 Welch t-검정을 수행해 호스트네임 내부 하이픈(NumDashInHostname)과 URL 길이의 피싱 상관관계를 규명하여 단독 연구 논문을 작성했습니다. 이어 연구 임계치를 브라우저 내부에서 즉시 연산하는 무서버 Vanilla JS 사전 진단기를 구현하고 CSV Injection 방어 로직을 적용했습니다.',
      r: '<strong>결과 (Result):</strong> 정상 대비 피싱 URL 호스트 하이픈 3.88배, 길이 2.82배 통계적 유의성(p<0.001) 입증 및 클라이언트 단독 실행 보안 웹앱 정식 배포를 완료했습니다.',
      specs: `[연구 논문 통계 & 웹앱 진단 명세]
• 분석 표본: web-page-phishing.csv (100,077건) + dataset6.csv (10,000건)
• 가설 정교화: 검색엔진(SEO) 경로 하이픈 왜곡을 제거하고 '호스트네임 내부 하이픈' 분리 측정
• 진단 알고리즘: URL 길이 29자 임계점, 호스트 하이픈 빈도, 위험 문자(@, =, .) 종합 가중합 점수화
• 클라이언트 보안: 제로 네트워크(Zero-Network) 브라우저 독립 분석 및 악성 수식 실행 차단(CSV 이스케이프)`,
      actions: [
        { label: '피싱 URL 사전 진단기 웹앱 실행 →', url: 'phishing-detector.html', primary: true },
        { label: '논문 파일 원문 다운로드/열람 ↗', url: 'https://drive.google.com/file/d/1JIYAKJRQSLqqQi_LWV_2zgnzysrBoxuY/view?usp=drivesdk', primary: false }
      ]
    },

    resilience: {
      tag: 'FEATURED 03 · RESILIENT WEB & PRIVACY TOOLS',
      title: '5종 장애 복원 보드 & 프라이버시 보안 웹앱 모음',
      s: '<strong>상황 (Situation):</strong> 외부 공공/금융 API 장애(Timeout, 403, 429, 스키마 변조) 발생 시 화면이 깨지거나 서비스가 중단되는 문제를 방지하고, 일상 이미지 공유 시 EXIF 위치·기기 메타데이터 노출을 차단할 도구가 필요했습니다.',
      a: '<strong>행동 (Action):</strong> 마지막 정상 데이터(LKG) 캐싱과 Stale 경보 전환을 수행하는 5종 장애 복원 상태 머신 보드를 설계하고, 브라우저 Canvas 리렌더링 기반 EXIF 완전 제거 스튜디오 및 방화벽 미니게임을 구현했습니다.',
      r: '<strong>결과 (Result):</strong> 네트워크 단절 및 비정상 응답 환경에서도 무중단 UI 가용성을 보장하고 클라이언트 단 개인정보 보호 유틸리티 세트를 완성했습니다.',
      specs: `[장애 복원 & 프라이버시 웹앱 명세]
• 오늘의 진짜 정보판 (board.html): Timeout / HTTP 403 / 429 Rate Limit / Offline / 스키마 변조 시뮬레이션 및 자동 복원
• 짤·카드 스튜디오 (studio.html): 이미지 업로드 시 EXIF GPS·카메라 메타데이터 원천 제거 후 안전한 PNG 출력
• 플랜두씨 다이어리 (plando.html) & 보안 방화벽 미니게임 (game.html)`,
      actions: [
        { label: '오늘의 진짜 정보판 실행 →', url: 'board.html', primary: true },
        { label: '짤·카드 스튜디오 →', url: 'studio.html', primary: false },
        { label: '플랜두씨 다이어리 →', url: 'plando.html', primary: false },
        { label: '방화벽 미니게임 →', url: 'game.html', primary: false }
      ]
    },

    scope: {
      tag: 'SECURITY CHECKLIST · DISCLOSURE SCOPE',
      title: '공개 범위 및 보안 점검표 (Disclosure Scope Checklist)',
      s: '<strong>대상 및 목적:</strong> 정보보안·네트워크 인프라 직무 채용 담당자와 IT 실무진에게 보안 엔지니어 이혜원의 기술 역량을 투명하게 전달합니다.',
      a: '<strong>보안 원칙:</strong> 개인정보보호법을 준수하고 시스템 자산 침해사고를 예방하기 위해 포트폴리오 공개/비공개 범위를 명확히 분리합니다.',
      r: '<strong>결과:</strong> 민감정보 노출 없는 안전한 공개 포트폴리오를 유지합니다.',
      specs: `[공개 정보 (4개 항목)]
1. 성명 및 지원 직무: 이혜원 / 정보보안 엔지니어, 네트워크 인프라, 보안관제
2. 보유 기술 스택: 방화벽·ACL(Cisco ASAv, pfSense), IDS/IPS(Snort, Suricata), Linux(Ubuntu, Rocky), AI Cowork 자동화 및 바이브 코딩
3. 공식 채용 소통 이메일: three78945@naver.com
4. 실무 산출물: 비식별화된 침입 탐지 룰셋, 네트워크 토폴로지 구조도, 모의해킹 보고서, 실증 연구 논문

[비공개 정보 (3개 항목)]
1. 주민등록번호, 생년월일 등 고유식별정보 (사유: 개인정보보호법 준수 및 도용 방지)
2. 개인 휴대전화번호 및 상세 거주지 주소 (사유: 사생활 보호 및 스팸 방지)
3. 실제 운영 시스템 계정 비밀번호, API Secret 키 및 토큰 원문 (사유: 침해사고 예방 및 보안 윤리)`,
      actions: []
    }
  };

  const openProjectModal = (key) => {
    if (!modal) return;
    const data = projectDetailsData[key];
    if (!data) return;

    lastActiveElement = document.activeElement;
    if (modalTopologyExplorer) {
      modalTopologyExplorer.classList.remove('active');
    }

    if (modalTag) modalTag.textContent = data.tag;
    if (modalTitle) modalTitle.textContent = data.title;
    if (modalSarS) modalSarS.innerHTML = data.s;
    if (modalSarA) modalSarA.innerHTML = data.a;
    if (modalSarR) modalSarR.innerHTML = data.r;
    if (modalSpecs) modalSpecs.textContent = data.specs;

    if (modalActions) {
      modalActions.innerHTML = '';
      if (data.actions && data.actions.length > 0) {
        data.actions.forEach((act) => {
          const a = document.createElement('a');
          a.href = act.url;
          a.className = act.primary ? 'btn-editorial btn-editorial-primary' : 'btn-editorial';
          a.textContent = act.label;
          if (act.url.startsWith('http')) {
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
          }
          modalActions.appendChild(a);
        });
      }
    }

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    if (modalClose) modalClose.focus();
  };

  const closeProjectModal = () => {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
      lastActiveElement.focus();
    }
  };

  document.querySelectorAll('.compact-project-card').forEach((card) => {
    card.addEventListener('click', () => {
      const key = card.dataset.projectKey;
      openProjectModal(key);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const key = card.dataset.projectKey;
        openProjectModal(key);
      }
    });
  });

  const btnOpenScope = document.getElementById('btn-open-scope-modal');
  if (btnOpenScope) {
    btnOpenScope.addEventListener('click', () => {
      openProjectModal('scope');
    });
  }

  if (modalClose) modalClose.addEventListener('click', closeProjectModal);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeProjectModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (lightboxOverlay && lightboxOverlay.classList.contains('open')) {
        closeLightbox();
        return;
      }
      if (modal && modal.classList.contains('open')) {
        closeProjectModal();
      }
    }
  });

  // 7. Passkey Authentication (WebAuthn)
  const btnRegister = document.getElementById('btn-register-passkey');
  const btnLogin = document.getElementById('btn-login-passkey');
  const btnLogout = document.getElementById('btn-logout');
  const authGate = document.getElementById('auth-gate');
  const privateContent = document.getElementById('private-content-area');
  const passkeyStatusMsg = document.getElementById('passkey-status-msg');

  const showPasskeyNotice = (msg) => {
    if (!passkeyStatusMsg) return;
    passkeyStatusMsg.textContent = msg;
    passkeyStatusMsg.classList.add('visible');
  };

  const coerceToArrayBuffer = (input) => {
    if (!input) return new ArrayBuffer(0);
    if (input instanceof ArrayBuffer) return input;
    if (ArrayBuffer.isView(input)) return input.buffer;
    if (typeof input === 'object' && input.type === 'Buffer' && Array.isArray(input.data)) {
      return new Uint8Array(input.data).buffer;
    }
    if (Array.isArray(input)) {
      return new Uint8Array(input).buffer;
    }
    if (typeof input === 'string') {
      let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) base64 += '=';
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    }
    return new ArrayBuffer(0);
  };

  const bufferToBase64URL = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  if (btnRegister) {
    btnRegister.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/passkey-register-start', { method: 'POST' });
        if (!res.ok) throw new Error('등록 챌린지를 가져오지 못했습니다.');
        const options = await res.json();
        options.challenge = coerceToArrayBuffer(options.challenge);
        if (options.user && options.user.id) options.user.id = coerceToArrayBuffer(options.user.id);
        if (options.excludeCredentials) {
          options.excludeCredentials.forEach((cred) => {
            cred.id = coerceToArrayBuffer(cred.id);
          });
        }
        const credential = await navigator.credentials.create({ publicKey: options });
        const verifyRes = await fetch('/api/passkey-register-finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: credential.id,
            rawId: bufferToBase64URL(credential.rawId),
            type: credential.type,
            response: {
              attestationObject: bufferToBase64URL(credential.response.attestationObject),
              clientDataJSON: bufferToBase64URL(credential.response.clientDataJSON),
            },
          }),
        });
        if (verifyRes.ok) {
          showPasskeyNotice('패스키가 성공적으로 등록되었습니다.');
        } else {
          showPasskeyNotice('패스키 등록 검증에 실패했습니다.');
        }
      } catch (error) {
        showPasskeyNotice('패스키 등록 안내: 서버리스 인증 엔드포인트 연결 환경에서 동작합니다.');
      }
    });
  }

  if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/passkey-login-start', { method: 'POST' });
        if (!res.ok) throw new Error('로그인 챌린지를 가져오지 못했습니다.');
        const options = await res.json();
        options.challenge = coerceToArrayBuffer(options.challenge);
        if (options.allowCredentials) {
          options.allowCredentials.forEach((cred) => {
            cred.id = coerceToArrayBuffer(cred.id);
          });
        }
        const credential = await navigator.credentials.get({ publicKey: options });
        const verifyRes = await fetch('/api/passkey-login-finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: credential.id,
            rawId: bufferToBase64URL(credential.rawId),
            type: credential.type,
            response: {
              authenticatorData: bufferToBase64URL(credential.response.authenticatorData),
              clientDataJSON: bufferToBase64URL(credential.response.clientDataJSON),
              signature: bufferToBase64URL(credential.response.signature),
              userHandle: credential.response.userHandle ? bufferToBase64URL(credential.response.userHandle) : null,
            },
          }),
        });
        if (verifyRes.ok) {
          if (authGate) authGate.style.display = 'none';
          if (privateContent) privateContent.style.display = 'block';
          showPasskeyNotice('인증 성공! 나만의 공간이 열렸습니다.');
        } else {
          showPasskeyNotice('인증에 실패했습니다. 등록된 기기인지 확인해주세요.');
        }
      } catch (error) {
        showPasskeyNotice('패스키 로그인 안내: 등록된 보안 키 및 서버리스 API 연결이 필요합니다.');
      }
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      if (authGate) authGate.style.display = 'flex';
      if (privateContent) privateContent.style.display = 'none';
      showPasskeyNotice('로그아웃 되었습니다. 화면이 다시 잠깁니다.');
    });
  }
});

// ============================================================================
// Master Unified Navigation & Dark/Light Theme Controller (Wonq Portfolio)
// ============================================================================
(function() {
  var THEME_KEY = 'wonq_portfolio_theme';

  function safeGetStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function safeSetStorage(key, val) {
    try {
      localStorage.setItem(key, val);
    } catch (e) {}
  }

  function applyTheme(theme) {
    var isDark = theme === 'dark';
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.classList.add('dark-theme');
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.body.classList.remove('dark-theme');
    }
    var toggleBtn = document.getElementById('btn-theme-toggle');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-label', isDark ? '라이트 모드로 전환' : '다크 모드로 전환');
      toggleBtn.setAttribute('title', isDark ? '라이트 모드로 전환' : '다크 모드로 전환');
    }
  }

  function getPreferredTheme() {
    var saved = safeGetStorage(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  function initApp() {
    var current = getPreferredTheme();
    applyTheme(current);

    var toggleBtn = document.getElementById('btn-theme-toggle');
    if (toggleBtn && !toggleBtn.dataset.themeBound) {
      toggleBtn.dataset.themeBound = 'true';
      toggleBtn.addEventListener('click', function(e) {
        e.preventDefault();
        var next = (document.documentElement.getAttribute('data-theme') === 'dark' || document.body.classList.contains('dark-theme')) ? 'light' : 'dark';
        applyTheme(next);
        safeSetStorage(THEME_KEY, next);
      });
    }

    var scrollProgress = document.getElementById('scroll-progress');
    var navbar = document.getElementById('navbar');
    var overviewDropdown = document.getElementById('nav-overview-dropdown');
    var overviewBtn = document.getElementById('nav-overview-btn');
    var projectsDropdown = document.getElementById('nav-projects-dropdown');
    var projectsBtn = document.getElementById('nav-projects-btn');
    var motionBtn = document.getElementById('btn-motion-toggle');

    if (projectsBtn && projectsBtn.dataset.navBound === 'true') return;
    if (projectsBtn) projectsBtn.dataset.navBound = 'true';

    var updateScroll = function() {
      var scrollY = window.scrollY || window.pageYOffset;
      if (navbar) {
        navbar.classList.toggle('scrolled', scrollY > 10);
      }
      if (scrollProgress) {
        var docHeight = document.documentElement.scrollHeight - window.innerHeight;
        var pct = docHeight > 0 ? (scrollY / docHeight) * 100 : 0;
        scrollProgress.style.width = Math.min(100, Math.max(0, pct)) + '%';
      }
    };
    window.addEventListener('scroll', updateScroll, { passive: true });
    updateScroll();

    var closeAllDropdowns = function() {
      if (overviewDropdown) {
        overviewDropdown.classList.remove('open');
        if (overviewBtn) overviewBtn.setAttribute('aria-expanded', 'false');
      }
      if (projectsDropdown) {
        projectsDropdown.classList.remove('open');
        if (projectsBtn) projectsBtn.setAttribute('aria-expanded', 'false');
      }
    };

    if (overviewBtn && overviewDropdown) {
      overviewBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var isOpen = overviewDropdown.classList.contains('open');
        closeAllDropdowns();
        if (!isOpen) {
          overviewDropdown.classList.add('open');
          overviewBtn.setAttribute('aria-expanded', 'true');
        }
      });
    }

    if (projectsBtn && projectsDropdown) {
      projectsBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var isOpen = projectsDropdown.classList.contains('open');
        closeAllDropdowns();
        if (!isOpen) {
          projectsDropdown.classList.add('open');
          projectsBtn.setAttribute('aria-expanded', 'true');
        }
      });
    }

    document.querySelectorAll('.dropdown-item').forEach(function(item) {
      item.addEventListener('click', function() {
        closeAllDropdowns();
      });
    });

    document.addEventListener('click', function(e) {
      var inOverview = overviewDropdown && overviewDropdown.contains(e.target);
      var inProjects = projectsDropdown && projectsDropdown.contains(e.target);
      if (!inOverview && !inProjects) {
        closeAllDropdowns();
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeAllDropdowns();
      }
    });

    if (motionBtn && !motionBtn.dataset.boundUnified) {
      motionBtn.dataset.boundUnified = 'true';
      motionBtn.addEventListener('click', function() {
        var reduced = document.body.classList.toggle('reduce-motion');
        motionBtn.setAttribute('aria-pressed', String(reduced));
        motionBtn.textContent = reduced ? '모션 줄이기: ON' : '모션 줄이기: OFF';
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();

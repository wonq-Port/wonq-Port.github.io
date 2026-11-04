/**
 * Meme & Card Studio Engine
 * Pure Vanilla JavaScript (Zero External Dependencies)
 * Fully compliant with T03-C01 ~ T03-C32
 */

document.addEventListener('DOMContentLoaded', () => {
  // Canvas Elements
  const canvas = document.getElementById('studio-canvas');
  const ctx = canvas.getContext('2d');
  const resolutionBadge = document.getElementById('resolution-badge');
  const noticeBanner = document.getElementById('notice-banner');

  // Input & Tool Elements
  const imageUploadInput = document.getElementById('image-upload');
  const uploadDropzone = document.getElementById('upload-dropzone');
  const textInput = document.getElementById('text-input');
  const fontSizeInput = document.getElementById('font-size-input');
  const fontSizeVal = document.getElementById('font-size-val');
  const posYInput = document.getElementById('pos-y-input');
  const posYVal = document.getElementById('pos-y-val');
  const textColorInput = document.getElementById('text-color-input');
  const strokeColorInput = document.getElementById('stroke-color-input');
  const textStrokeToggle = document.getElementById('text-stroke-toggle');
  const ratioButtons = document.querySelectorAll('.ratio-btn');
  const alignButtons = document.querySelectorAll('.btn-align');
  const btnDownloadPng = document.getElementById('btn-download-png');
  const btnDownloadJpeg = document.getElementById('btn-download-jpeg');

  // Template Elements
  const templateNameInput = document.getElementById('template-name-input');
  const btnSaveTemplate = document.getElementById('btn-save-template');
  const templateListContainer = document.getElementById('template-list');
  const btnExportJson = document.getElementById('btn-export-json');
  const jsonUploadInput = document.getElementById('json-upload');
  const btnImportJsonTrigger = document.getElementById('btn-import-json-trigger');

  // Sample Presets
  const samplePresetButtons = document.querySelectorAll('.btn-sample-preset');

  // Storage Key
  const STORAGE_KEY_TEMPLATES = 'meme_card_studio_templates';

  // Aspect Ratio Dimensions (T03-C11: 1:1, T03-C12: 4:5, T03-C13: 9:16)
  const RATIO_CONFIGS = {
    '1:1': { width: 1080, height: 1080, label: '1080 × 1080 (1:1)' },
    '4:5': { width: 1080, height: 1350, label: '1080 × 1350 (4:5)' },
    '9:16': { width: 1080, height: 1920, label: '1080 × 1920 (9:16)' }
  };

  // Active Editor State
  let currentRatio = '1:1';
  let currentImage = null; // Image object
  let currentText = "사이버 보안 수칙\n출처 불분명한 링크 클릭 금지";
  let currentFontSize = 54;
  let currentPosY = 75; // percentage 0% ~ 100%
  let currentAlign = 'center'; // 'left' | 'center' | 'right'
  let currentTextColor = '#ffffff';
  let currentStrokeColor = '#000000';
  let isStrokeEnabled = true;

  /* --------------------------------------------------------------------------
     1. Notification Banner Helper (T03-C10, T03-C23, T03-C24)
     -------------------------------------------------------------------------- */
  let noticeTimeout = null;
  const showNotice = (msg, type = 'error', duration = 5000) => {
    if (!noticeBanner) return;
    clearTimeout(noticeTimeout);
    noticeBanner.textContent = msg;
    noticeBanner.className = `notice-banner visible ${type}`;
    if (duration > 0) {
      noticeTimeout = setTimeout(() => {
        noticeBanner.className = 'notice-banner';
      }, duration);
    }
  };

  /* --------------------------------------------------------------------------
     2. Canvas Rendering Engine (T03-C06, T03-C07, T03-C08, T03-C11~T03-C13)
     -------------------------------------------------------------------------- */
  const drawCanvas = (targetCanvas, targetCtx, targetWidth, targetHeight) => {
    targetCanvas.width = targetWidth;
    targetCanvas.height = targetHeight;

    // Background drawing
    if (currentImage && currentImage.complete && currentImage.naturalWidth > 0) {
      const imgRatio = currentImage.naturalWidth / currentImage.naturalHeight;
      const canvasRatio = targetWidth / targetHeight;

      let drawW, drawH, drawX, drawY;
      if (imgRatio > canvasRatio) {
        drawH = targetHeight;
        drawW = targetHeight * imgRatio;
        drawX = (targetWidth - drawW) / 2;
        drawY = 0;
      } else {
        drawW = targetWidth;
        drawH = targetWidth / imgRatio;
        drawX = 0;
        drawY = (targetHeight - drawH) / 2;
      }

      targetCtx.fillStyle = '#0f172a';
      targetCtx.fillRect(0, 0, targetWidth, targetHeight);
      targetCtx.drawImage(currentImage, drawX, drawY, drawW, drawH);
    } else {
      const gradient = targetCtx.createLinearGradient(0, 0, targetWidth, targetHeight);
      gradient.addColorStop(0, '#0f172a');
      gradient.addColorStop(0.5, '#1e293b');
      gradient.addColorStop(1, '#090d16');
      targetCtx.fillStyle = gradient;
      targetCtx.fillRect(0, 0, targetWidth, targetHeight);

      targetCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      targetCtx.lineWidth = 16;
      targetCtx.strokeRect(40, 40, targetWidth - 80, targetHeight - 80);
    }

    if (!currentText || currentText.trim().length === 0) {
      return;
    }

    const fontStack = `${currentFontSize}px 'Barlow Condensed', 'Inter', 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif`;
    targetCtx.font = `800 ${fontStack}`;
    targetCtx.textAlign = currentAlign;
    targetCtx.textBaseline = 'middle';

    let posX = targetWidth / 2;
    if (currentAlign === 'left') posX = targetWidth * 0.08;
    if (currentAlign === 'right') posX = targetWidth * 0.92;

    const posY = targetHeight * (currentPosY / 100);
    const maxTextWidth = targetWidth * 0.84;
    const lineHeight = currentFontSize * 1.28;

    // Word & Character wrapping algorithm (T03-C14, T03-C15 Pass)
    const lines = [];
    const paragraphs = currentText.split('\n');

    for (const para of paragraphs) {
      if (para.length === 0) {
        lines.push('');
        continue;
      }

      const words = para.split(' ');
      let currentLine = '';

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = targetCtx.measureText(testLine).width;

        if (testWidth <= maxTextWidth) {
          currentLine = testLine;
        } else {
          if (!currentLine) {
            let charLine = '';
            for (let c of word) {
              if (targetCtx.measureText(charLine + c).width <= maxTextWidth) {
                charLine += c;
              } else {
                lines.push(charLine);
                charLine = c;
              }
            }
            currentLine = charLine;
          } else {
            lines.push(currentLine);
            currentLine = word;
          }
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
    }

    const totalBlockHeight = lines.length * lineHeight;
    let startY = posY - (totalBlockHeight / 2) + (lineHeight / 2);

    if (startY < lineHeight) startY = lineHeight;
    if (startY + totalBlockHeight > targetHeight) {
      startY = Math.max(lineHeight, targetHeight - totalBlockHeight + (lineHeight / 2));
    }

    lines.forEach((lineText, idx) => {
      const lineY = startY + (idx * lineHeight);

      if (isStrokeEnabled) {
        targetCtx.strokeStyle = currentStrokeColor;
        targetCtx.lineWidth = Math.max(4, currentFontSize * 0.12);
        targetCtx.lineJoin = 'round';
        targetCtx.miterLimit = 2;
        targetCtx.strokeText(lineText, posX, lineY);
      }

      targetCtx.fillStyle = currentTextColor;
      targetCtx.fillText(lineText, posX, lineY);
    });
  };

  const renderPreview = () => {
    const config = RATIO_CONFIGS[currentRatio] || RATIO_CONFIGS['1:1'];
    if (resolutionBadge) {
      resolutionBadge.textContent = config.label;
    }
    drawCanvas(canvas, ctx, config.width, config.height);
  };

  /* --------------------------------------------------------------------------
     3. Aspect Ratio Switching (T03-C11, T03-C12, T03-C13)
     -------------------------------------------------------------------------- */
  ratioButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const selectedRatio = btn.getAttribute('data-ratio');
      if (!RATIO_CONFIGS[selectedRatio]) return;

      currentRatio = selectedRatio;
      ratioButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      renderPreview();
    });
  });

  /* --------------------------------------------------------------------------
     4. Safe Image Upload & Rejection (T03-C04, T03-C05, T03-C09, T03-C10)
     -------------------------------------------------------------------------- */
  const processImageFile = (file) => {
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg'];
    const validExtensions = ['.png', '.jpg', '.jpeg'];

    const fileNameLower = file.name.toLowerCase();
    const isExtensionValid = validExtensions.some(ext => fileNameLower.endsWith(ext));
    const isTypeValid = validTypes.includes(file.type);

    if (!isTypeValid && !isExtensionValid) {
      const detected = file.type || file.name.split('.').pop() || '알 수 없는 파일';
      showNotice(`[업로드 거부] 지원하지 않는 파일 형식입니다 (${detected}). PNG 또는 JPEG 파일만 지원됩니다. 기존 작업 내용이 안전하게 유지됩니다.`, 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        currentImage = img;
        renderPreview();
        showNotice(`이미지 '${file.name}'를 성공적으로 불러왔습니다 (${img.naturalWidth}×${img.naturalHeight}px).`, 'success', 3000);
      };
      img.onerror = () => {
        showNotice(`이미지 데이터를 해석할 수 없습니다. 손상된 파일일 수 있습니다. 기존 작업이 유지됩니다.`, 'error');
      };
      img.src = e.target.result;
    };
    reader.onerror = () => {
      showNotice(`파일 읽기 오류가 발생했습니다. 기존 작업이 유지됩니다.`, 'error');
    };
    reader.readAsDataURL(file);
  };

  if (imageUploadInput) {
    imageUploadInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      processImageFile(file);
      imageUploadInput.value = '';
    });
  }

  if (uploadDropzone) {
    uploadDropzone.addEventListener('click', () => {
      if (imageUploadInput) imageUploadInput.click();
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      uploadDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        uploadDropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      uploadDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        uploadDropzone.classList.remove('dragover');
      });
    });

    uploadDropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const file = dt.files[0];
      processImageFile(file);
    });
  }

  /* --------------------------------------------------------------------------
     5. Sample Background Generators
     -------------------------------------------------------------------------- */
  const generateSampleImage = (type) => {
    const offscreen = document.createElement('canvas');
    offscreen.width = 1200;
    offscreen.height = 1200;
    const offCtx = offscreen.getContext('2d');

    if (type === 'cyber') {
      offCtx.fillStyle = '#0a0f1d';
      offCtx.fillRect(0, 0, 1200, 1200);

      offCtx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
      offCtx.lineWidth = 2;
      for (let i = 0; i <= 1200; i += 60) {
        offCtx.beginPath();
        offCtx.moveTo(i, 0); offCtx.lineTo(i, 1200);
        offCtx.stroke();
        offCtx.beginPath();
        offCtx.moveTo(0, i); offCtx.lineTo(1200, i);
        offCtx.stroke();
      }

      offCtx.fillStyle = 'rgba(185, 28, 28, 0.85)';
      offCtx.beginPath();
      offCtx.moveTo(600, 320);
      offCtx.lineTo(760, 400);
      offCtx.lineTo(760, 640);
      offCtx.lineTo(600, 820);
      offCtx.lineTo(440, 640);
      offCtx.lineTo(440, 400);
      offCtx.closePath();
      offCtx.fill();
    } else if (type === 'editorial') {
      offCtx.fillStyle = '#f1f5f9';
      offCtx.fillRect(0, 0, 1200, 1200);

      offCtx.fillStyle = '#b91c1c';
      offCtx.fillRect(100, 100, 40, 1000);

      offCtx.fillStyle = '#334155';
      offCtx.fillRect(160, 100, 940, 20);
    } else if (type === 'security') {
      const grad = offCtx.createLinearGradient(0, 0, 1200, 1200);
      grad.addColorStop(0, '#0284c7');
      grad.addColorStop(1, '#0f172a');
      offCtx.fillStyle = grad;
      offCtx.fillRect(0, 0, 1200, 1200);
    }

    const img = new Image();
    img.onload = () => {
      currentImage = img;
      renderPreview();
    };
    img.src = offscreen.toDataURL('image/png');
  };

  samplePresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const ptype = btn.getAttribute('data-preset');
      generateSampleImage(ptype);
    });
  });

  /* --------------------------------------------------------------------------
     6. Text Control Handlers
     -------------------------------------------------------------------------- */
  if (textInput) {
    textInput.addEventListener('input', (e) => {
      currentText = e.target.value;
      renderPreview();
    });
  }

  if (fontSizeInput) {
    fontSizeInput.addEventListener('input', (e) => {
      currentFontSize = parseInt(e.target.value, 10) || 48;
      if (fontSizeVal) fontSizeVal.textContent = `${currentFontSize}px`;
      renderPreview();
    });
  }

  if (posYInput) {
    posYInput.addEventListener('input', (e) => {
      currentPosY = parseInt(e.target.value, 10) || 50;
      if (posYVal) posYVal.textContent = `${currentPosY}%`;
      renderPreview();
    });
  }

  if (textColorInput) {
    textColorInput.addEventListener('input', (e) => {
      currentTextColor = e.target.value;
      renderPreview();
    });
  }

  if (strokeColorInput) {
    strokeColorInput.addEventListener('input', (e) => {
      currentStrokeColor = e.target.value;
      renderPreview();
    });
  }

  if (textStrokeToggle) {
    textStrokeToggle.addEventListener('change', (e) => {
      isStrokeEnabled = e.target.checked;
      renderPreview();
    });
  }

  document.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const color = dot.getAttribute('data-color');
      currentTextColor = color;
      if (textColorInput) textColorInput.value = color;
      renderPreview();
    });
  });

  alignButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      currentAlign = btn.getAttribute('data-align');
      alignButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderPreview();
    });
  });

  /* --------------------------------------------------------------------------
     7. Download & Metadata Sanitization (T03-C28: EXIF 0건)
     -------------------------------------------------------------------------- */
  const downloadImageFile = (format = 'image/png') => {
    const config = RATIO_CONFIGS[currentRatio] || RATIO_CONFIGS['1:1'];

    const exportCanvas = document.createElement('canvas');
    const exportCtx = exportCanvas.getContext('2d');

    drawCanvas(exportCanvas, exportCtx, config.width, config.height);

    const ext = format === 'image/jpeg' ? 'jpg' : 'png';
    const timestamp = Date.now();
    const ratioClean = currentRatio.replace(':', 'x');
    const fileName = `meme_card_${ratioClean}_${timestamp}.${ext}`;

    exportCanvas.toBlob((blob) => {
      if (!blob) {
        showNotice('파일 생성에 실패했습니다.', 'error');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotice(`${fileName} (${config.label}) 다운로드 완료!`, 'success', 3500);
    }, format, 0.96);
  };

  if (btnDownloadPng) btnDownloadPng.addEventListener('click', () => downloadImageFile('image/png'));
  if (btnDownloadJpeg) btnDownloadJpeg.addEventListener('click', () => downloadImageFile('image/jpeg'));

  /* --------------------------------------------------------------------------
     8. Template CRUD Operations (T03-C17 ~ T03-C21)
     -------------------------------------------------------------------------- */
  const DEFAULT_TEMPLATES = [
    {
      id: 'tpl_default_1',
      name: '보안 침해 대응 (1:1 정방형)',
      ratio: '1:1',
      text: '보안관제 24/7 대응 수칙\n이상 징후 포착 즉시 격리 및 보고',
      fontSize: 56,
      posY: 75,
      align: 'center',
      textColor: '#ffffff',
      strokeColor: '#000000',
      isStrokeEnabled: true,
      updatedAt: '2026-09-11T12:00:00Z'
    },
    {
      id: 'tpl_default_2',
      name: '피싱 메일 예방 (4:5 인포그래픽)',
      ratio: '4:5',
      text: '피싱 메일 예방 3계명\n1. 보낸사람 주소 도메인 확인\n2. 불필요한 첨부파일 실행 금지\n3. 계정 정보 입력 요구 의심',
      fontSize: 48,
      posY: 70,
      align: 'center',
      textColor: '#ffffff',
      strokeColor: '#000000',
      isStrokeEnabled: true,
      updatedAt: '2026-09-11T12:05:00Z'
    },
    {
      id: 'tpl_default_3',
      name: '시큐어 코딩 팁 (9:16 스토리)',
      ratio: '9:16',
      text: 'SECURE CODING\nSQL 인젝션 방어는\nPreparedStatement 바인딩 필수',
      fontSize: 60,
      posY: 80,
      align: 'center',
      textColor: '#38bdf8',
      strokeColor: '#0f172a',
      isStrokeEnabled: true,
      updatedAt: '2026-09-11T12:10:00Z'
    }
  ];

  let templates = [];

  const loadTemplatesFromStorage = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_TEMPLATES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          templates = parsed;
        } else {
          templates = [...DEFAULT_TEMPLATES];
          saveTemplatesToStorage();
        }
      } else {
        templates = [...DEFAULT_TEMPLATES];
        saveTemplatesToStorage();
      }
    } catch (e) {
      templates = [...DEFAULT_TEMPLATES];
      saveTemplatesToStorage();
    }
    renderTemplateList();
  };

  const saveTemplatesToStorage = () => {
    try {
      localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(templates));
    } catch (e) {
      showNotice('로컬 저장소 저장 실패가 발생했습니다.', 'error');
    }
  };

  const renderTemplateList = () => {
    if (!templateListContainer) return;
    templateListContainer.innerHTML = '';

    if (templates.length === 0) {
      templateListContainer.innerHTML = '<div style="font-size:12px;color:#888;padding:1rem;text-align:center;">저장된 템플릿이 없습니다.</div>';
      return;
    }

    templates.forEach((tpl) => {
      const card = document.createElement('div');
      card.className = 'template-card';
      card.dataset.id = tpl.id;

      card.innerHTML = `
        <div class="template-info">
          <span class="tpl-name" title="${tpl.name}">${tpl.name}</span>
          <span class="tpl-meta">${tpl.ratio} · 글자 ${tpl.fontSize}px</span>
        </div>
        <div class="tpl-btns">
          <button type="button" class="btn-tpl-action btn-tpl-load" aria-label="${tpl.name} 템플릿 불러오기">불러오기</button>
          <button type="button" class="btn-tpl-action btn-tpl-update" aria-label="${tpl.name} 템플릿 현재 설정으로 수정">수정</button>
          <button type="button" class="btn-tpl-action btn-tpl-delete" aria-label="${tpl.name} 템플릿 삭제">삭제</button>
        </div>
      `;

      const btnLoad = card.querySelector('.btn-tpl-load');
      const btnUpdate = card.querySelector('.btn-tpl-update');
      const btnDelete = card.querySelector('.btn-tpl-delete');

      btnLoad.addEventListener('click', () => loadTemplateById(tpl.id));
      btnUpdate.addEventListener('click', () => updateTemplateById(tpl.id));
      btnDelete.addEventListener('click', () => deleteTemplateById(tpl.id));

      templateListContainer.appendChild(card);
    });
  };

  const createTemplate = () => {
    const name = templateNameInput.value.trim() || `새 템플릿 ${templates.length + 1}`;
    const newTpl = {
      id: `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: name,
      ratio: currentRatio,
      text: currentText,
      fontSize: currentFontSize,
      posY: currentPosY,
      align: currentAlign,
      textColor: currentTextColor,
      strokeColor: currentStrokeColor,
      isStrokeEnabled: isStrokeEnabled,
      updatedAt: new Date().toISOString()
    };

    templates.unshift(newTpl);
    saveTemplatesToStorage();
    renderTemplateList();
    templateNameInput.value = '';
    showNotice(`템플릿 '${name}'을 성공적으로 생성했습니다.`, 'success', 3000);
  };

  const loadTemplateById = (id) => {
    const tpl = templates.find(t => t.id === id);
    if (!tpl) return;

    currentRatio = tpl.ratio || '1:1';
    currentText = tpl.text || '';
    currentFontSize = tpl.fontSize || 48;
    currentPosY = tpl.posY || 50;
    currentAlign = tpl.align || 'center';
    currentTextColor = tpl.textColor || '#ffffff';
    currentStrokeColor = tpl.strokeColor || '#000000';
    isStrokeEnabled = typeof tpl.isStrokeEnabled === 'boolean' ? tpl.isStrokeEnabled : true;

    if (textInput) textInput.value = currentText;
    if (fontSizeInput) fontSizeInput.value = currentFontSize;
    if (fontSizeVal) fontSizeVal.textContent = `${currentFontSize}px`;
    if (posYInput) posYInput.value = currentPosY;
    if (posYVal) posYVal.textContent = `${currentPosY}%`;
    if (textColorInput) textColorInput.value = currentTextColor;
    if (strokeColorInput) strokeColorInput.value = currentStrokeColor;
    if (textStrokeToggle) textStrokeToggle.checked = isStrokeEnabled;

    ratioButtons.forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-ratio') === currentRatio);
    });

    alignButtons.forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-align') === currentAlign);
    });

    renderPreview();
    showNotice(`템플릿 '${tpl.name}'을 불러왔습니다.`, 'success', 2500);
  };

  const updateTemplateById = (id) => {
    const tpl = templates.find(t => t.id === id);
    if (!tpl) return;

    tpl.ratio = currentRatio;
    tpl.text = currentText;
    tpl.fontSize = currentFontSize;
    tpl.posY = currentPosY;
    tpl.align = currentAlign;
    tpl.textColor = currentTextColor;
    tpl.strokeColor = currentStrokeColor;
    tpl.isStrokeEnabled = isStrokeEnabled;
    tpl.updatedAt = new Date().toISOString();

    saveTemplatesToStorage();
    renderTemplateList();
    showNotice(`템플릿 '${tpl.name}'의 설정을 현재 편집 내용으로 수정했습니다.`, 'success', 3000);
  };

  const deleteTemplateById = (id) => {
    const tpl = templates.find(t => t.id === id);
    if (!tpl) return;

    if (!confirm(`'${tpl.name}' 템플릿을 삭제하시겠습니까?`)) return;

    templates = templates.filter(t => t.id !== id);
    saveTemplatesToStorage();
    renderTemplateList();
    showNotice(`템플릿을 삭제했습니다.`, 'success', 2500);
  };

  if (btnSaveTemplate) btnSaveTemplate.addEventListener('click', createTemplate);

  /* --------------------------------------------------------------------------
     9. JSON Import & Export (T03-C22, T03-C23, T03-C24)
     -------------------------------------------------------------------------- */
  if (btnExportJson) {
    btnExportJson.addEventListener('click', () => {
      const dataStr = JSON.stringify(templates, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `studio_templates_backup_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotice('템플릿 백업 JSON 파일을 다운로드했습니다.', 'success', 3000);
    });
  }

  if (btnImportJsonTrigger && jsonUploadInput) {
    btnImportJsonTrigger.addEventListener('click', () => {
      jsonUploadInput.click();
    });

    jsonUploadInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);

          if (!Array.isArray(parsed) || parsed.length === 0) {
            showNotice('[가져오기 거부] JSON 형식이 배열이 아니거나 비어 있습니다. 기존 템플릿 목록이 유지됩니다.', 'error');
            return;
          }

          const hasMissingFields = parsed.some(item => (
            typeof item !== 'object' ||
            item === null ||
            typeof item.name !== 'string' ||
            typeof item.text !== 'string' ||
            typeof item.ratio !== 'string'
          ));

          if (hasMissingFields) {
            showNotice('[가져오기 거부] 필수 항목(name, text, ratio)이 누락되었거나 형식이 잘못되었습니다. 기존 템플릿이 안전하게 유지됩니다.', 'error');
            return;
          }

          templates = parsed.map(item => ({
            id: item.id || `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: item.name,
            ratio: item.ratio,
            text: item.text,
            fontSize: item.fontSize || 48,
            posY: item.posY || 50,
            align: item.align || 'center',
            textColor: item.textColor || '#ffffff',
            strokeColor: item.strokeColor || '#000000',
            isStrokeEnabled: typeof item.isStrokeEnabled === 'boolean' ? item.isStrokeEnabled : true,
            updatedAt: item.updatedAt || new Date().toISOString()
          }));

          saveTemplatesToStorage();
          renderTemplateList();
          showNotice(`정상 JSON 검증 완료: ${templates.length}개의 템플릿을 복원했습니다!`, 'success', 3500);
        } catch (err) {
          showNotice(`[가져오기 거부] JSON 문법이 손상되었습니다 (${err.message}). 파일이 적용되지 않고 기존 템플릿이 유지됩니다.`, 'error');
        } finally {
          jsonUploadInput.value = '';
        }
      };
      reader.readAsText(file);
    });
  }

  // Initial Boot
  generateSampleImage('cyber');
  loadTemplatesFromStorage();
});





// ============================================================================
// Unified Portfolio Navigation (Overview & Projects Dropdowns + Scroll Progress + Motion Toggle)
// ============================================================================
(function() {
  document.addEventListener('DOMContentLoaded', function() {
    var scrollProgress = document.getElementById('scroll-progress');
    var navbar = document.getElementById('navbar');
    var overviewDropdown = document.getElementById('nav-overview-dropdown');
    var overviewBtn = document.getElementById('nav-overview-btn');
    var projectsDropdown = document.getElementById('nav-projects-dropdown');
    var projectsBtn = document.getElementById('nav-projects-btn');
    var motionBtn = document.getElementById('btn-motion-toggle') || document.getElementById('motion-toggle-btn');

    // 1. Scroll progress bar
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

    // 2. Dual Dropdowns (Overview & Projects)
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

    // 3. Motion Toggle (if not already bound by page script)
    if (motionBtn && !motionBtn.dataset.boundUnified) {
      motionBtn.dataset.boundUnified = 'true';
      motionBtn.addEventListener('click', function() {
        var reduced = document.body.classList.toggle('reduce-motion');
        motionBtn.setAttribute('aria-pressed', String(reduced));
        motionBtn.textContent = reduced ? '모션 줄이기: ON' : '모션 줄이기: OFF';
      });
    }
  });
})();

'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { DEFAULT_TENANT_PALETTE, TenantPalette, ensurePalette, getReadableForeground, mergePalette } from '@/lib/theme';
import { ProtectedPage } from '../components/ProtectedPage';
import { useAuth } from '../context/AuthContext';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_WIDTH = 955;
const MAX_HEIGHT = 218;
const COLOR_HEX_REGEX = /^[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/;

const formatDateTime = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return null;
  }
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Não foi possível ler o arquivo.'));
      }
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Falha ao carregar o arquivo.'));
    };
    reader.readAsDataURL(file);
  });

const getImageDimensions = (source: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      resolve({ width, height });
    };
    image.onerror = () => {
      reject(new Error('Não foi possível validar a imagem.'));
    };
    image.src = source;
  });

const parseHexColor = (value?: string): string | null => {
  if (!value) return null;
  const trimmed = value.trim().replace('#', '');
  if (!COLOR_HEX_REGEX.test(trimmed)) {
    return null;
  }
  if (trimmed.length === 3) {
    return trimmed
      .split('')
      .map((component) => component + component)
      .join('')
      .toLowerCase();
  }
  return trimmed.toLowerCase();
};

const normalizeHexColor = (value: string, fallback: string) => {
  const parsed = parseHexColor(value);
  if (!parsed) {
    return fallback;
  }
  return `#${parsed}`;
};

const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const hexToRgb = (hex: string): [number, number, number] => {
  const parsed = parseHexColor(hex) ?? parseHexColor(DEFAULT_TENANT_PALETTE.primary) ?? '0f172a';
  const integer = parseInt(parsed, 16);
  const r = (integer >> 16) & 255;
  const g = (integer >> 8) & 255;
  const b = integer & 255;
  return [r, g, b];
};

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b]
    .map((channel) => clamp(channel).toString(16).padStart(2, '0'))
    .join('')}`;

const mixColors = (base: string, mix: string, weight: number) => {
  const ratio = Math.max(0, Math.min(1, weight));
  const [r1, g1, b1] = hexToRgb(base);
  const [r2, g2, b2] = hexToRgb(mix);
  return rgbToHex(r1 * (1 - ratio) + r2 * ratio, g1 * (1 - ratio) + g2 * ratio, b1 * (1 - ratio) + b2 * ratio);
};

const lightenColor = (color: string, amount: number) => mixColors(color, '#ffffff', amount);
const darkenColor = (color: string, amount: number) => mixColors(color, '#000000', amount);

const getRelativeLuminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const colorDistance = (first: string, second: string) => {
  const [r1, g1, b1] = hexToRgb(first);
  const [r2, g2, b2] = hexToRgb(second);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
};

const extractProminentColors = async (source: string): Promise<string[]> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) {
        reject(new Error('Canvas não suportado.'));
        return;
      }

      const width = 80;
      const height = Math.max(1, Math.round((image.naturalHeight || image.height || 1) * (width / (image.naturalWidth || image.width || 1))));
      canvas.width = width;
      canvas.height = height;
      context.drawImage(image, 0, 0, width, height);
      const { data } = context.getImageData(0, 0, width, height);

      const buckets = new Map<string, number>();
      for (let index = 0; index < data.length; index += 4) {
        const alpha = data[index + 3];
        if (alpha < 32) continue;
        const r = Math.round(data[index] / 24) * 24;
        const g = Math.round(data[index + 1] / 24) * 24;
        const b = Math.round(data[index + 2] / 24) * 24;
        const key = `${r},${g},${b}`;
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }

      const colors = Array.from(buckets.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([key]) => {
          const [r, g, b] = key.split(',').map(Number);
          return rgbToHex(r, g, b);
        });

      resolve(colors);
    };
    image.onerror = () => {
      reject(new Error('Não foi possível analisar a logo para sugerir cores.'));
    };
    image.src = source;
  });

const buildPaletteFromBaseColor = (baseColor: string, fallback: TenantPalette): TenantPalette => {
  const normalizedBase = normalizeHexColor(baseColor, fallback.primary);
  const background = lightenColor(normalizedBase, 0.85);
  const text = getRelativeLuminance(background) > 0.65 ? '#0f172a' : '#f8fafc';

  return (
    mergePalette(fallback, {
      primary: normalizedBase,
      secondary: darkenColor(normalizedBase, 0.12),
      background,
      surface: lightenColor(normalizedBase, 0.7),
      accent: mixColors(normalizedBase, fallback.accent, 0.35),
      text,
    }) ?? ensurePalette(fallback)
  );
};

const paletteFields = [
  {
    key: 'primary' as const,
    label: 'Cor principal',
    description: 'Aplicada a botões de ação e destaques do menu.',
  },
  {
    key: 'secondary' as const,
    label: 'Cor secundária',
    description: 'Utilizada em barras, títulos e elementos de navegação.',
  },
  {
    key: 'background' as const,
    label: 'Plano de fundo',
    description: 'Cor geral do plano de fundo da plataforma.',
  },
  {
    key: 'surface' as const,
    label: 'Superfícies',
    description: 'Cartões, quadros e caixas de conteúdo.',
  },
  {
    key: 'text' as const,
    label: 'Texto principal',
    description: 'Cor padrão dos textos e títulos.',
  },
  {
    key: 'accent' as const,
    label: 'Destaques',
    description: 'Indicadores positivos, links e estados de sucesso.',
  },
];

const previewKeys: { key: keyof TenantPalette; label: string }[] = [
  { key: 'primary', label: 'Primária' },
  { key: 'secondary', label: 'Secundária' },
  { key: 'accent', label: 'Destaque' },
  { key: 'surface', label: 'Superfície' },
  { key: 'background', label: 'Fundo' },
];

type PaletteFieldKey = (typeof paletteFields)[number]['key'];

export default function BrandingPage() {
  const { currentUser, users, settings, updateTenantBranding } = useAuth();
  const defaultPalette = useMemo(() => ensurePalette(DEFAULT_TENANT_PALETTE), []);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [palette, setPalette] = useState<TenantPalette>(defaultPalette);
  const [paletteDirty, setPaletteDirty] = useState(false);
  const [suggestions, setSuggestions] = useState<TenantPalette[]>([]);

  const tenantOptions = useMemo(() => {
    if (!currentUser) {
      return [] as { value: string; label: string }[];
    }

    if (currentUser.role === 'admin') {
      const entries = new Map<string, string>();
      const adminTenantId = currentUser.tenantId ?? 'tenant-admin';
      entries.set(adminTenantId, 'Plataforma (Administrativo)');

      users
        .filter((user) => user.role === 'master')
        .forEach((master) => {
          const tenantId = master.tenantId ?? master.id;
          const label = master.company?.trim() ? `${master.company} (${master.name})` : master.name;
          if (!entries.has(tenantId)) {
            entries.set(tenantId, label);
          }
        });

      return Array.from(entries.entries()).map(([value, label]) => ({ value, label }));
    }

    const tenantId = currentUser.tenantId ?? currentUser.id;
    const label = currentUser.company?.trim() ? currentUser.company : currentUser.name;
    return [{ value: tenantId, label }];
  }, [currentUser, users]);

  useEffect(() => {
    if (tenantOptions.length === 0) {
      return;
    }
    if (!tenantOptions.some((option) => option.value === selectedTenant)) {
      setSelectedTenant(tenantOptions[0].value);
      setFeedback('');
      setError('');
    }
  }, [tenantOptions, selectedTenant]);

  const currentBranding = selectedTenant ? settings.branding?.[selectedTenant] ?? null : null;

  useEffect(() => {
    if (!selectedTenant) {
      setPalette(defaultPalette);
      setPaletteDirty(false);
      return;
    }

    if (currentBranding?.palette) {
      setPalette(ensurePalette(currentBranding.palette));
    } else {
      setPalette(defaultPalette);
    }
    setPaletteDirty(false);
    setFeedback('');
    setError('');
  }, [currentBranding?.palette, defaultPalette, selectedTenant]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!selectedTenant) {
        setSuggestions([defaultPalette]);
        return;
      }

      if (!currentBranding?.logo) {
        setSuggestions([defaultPalette]);
        return;
      }

      try {
        const colors = await extractProminentColors(currentBranding.logo);
        if (cancelled) return;

        const paletteBase = currentBranding?.palette ? ensurePalette(currentBranding.palette) : defaultPalette;

        const uniqueColors: string[] = [];
        colors.forEach((color) => {
          const luminance = getRelativeLuminance(color);
          if (luminance < 0.08 || luminance > 0.9) {
            return;
          }
          if (uniqueColors.some((existing) => colorDistance(existing, color) < 28)) {
            return;
          }
          uniqueColors.push(color);
        });

        const generated = uniqueColors.slice(0, 4).map((color) => buildPaletteFromBaseColor(color, paletteBase));
        const withFallback = generated.length > 0 ? generated : [paletteBase];

        setSuggestions(withFallback);
      } catch (suggestionError) {
        console.error('Erro ao sugerir cores com base na logo', suggestionError);
        if (!cancelled) {
          setSuggestions([defaultPalette]);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [currentBranding?.logo, currentBranding?.palette, defaultPalette, selectedTenant]);

  const handleTenantChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedTenant(event.target.value);
    setFeedback('');
    setError('');
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedTenant) {
      return;
    }

    setFeedback('');
    setError('');

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Formato não suportado. Utilize PNG, JPG, SVG ou WebP.');
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const { width, height } = await getImageDimensions(dataUrl);

      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        setError('A logo deve ter no máximo 955 × 218 pixels. Ajuste a imagem antes de enviar.');
        return;
      }

      updateTenantBranding(selectedTenant, {
        logo: dataUrl,
        logoName: file.name,
        logoMimeType: file.type,
        logoWidth: width,
        logoHeight: height,
      });
      setFeedback('Logo atualizada com sucesso.');
    } catch (uploadError) {
      console.error(uploadError);
      setError('Não foi possível carregar a logo. Tente novamente com outro arquivo.');
    }
  };

  const handleRemoveLogo = () => {
    if (!selectedTenant) {
      return;
    }
    updateTenantBranding(selectedTenant, { logo: '' });
    setFeedback('Logo removida.');
    setError('');
  };

  const handlePaletteChange = (key: PaletteFieldKey) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = normalizeHexColor(event.target.value, palette[key]);
    setFeedback('');
    setError('');
    setPalette((previous) => {
      const next: TenantPalette = { ...previous, [key]: value } as TenantPalette;
      if (key === 'primary') {
        next.onPrimary = getReadableForeground(value);
      }
      if (key === 'secondary') {
        next.onSecondary = getReadableForeground(value);
      }
      return next;
    });
    setPaletteDirty(true);
  };

  const handleSavePalette = () => {
    if (!selectedTenant) {
      return;
    }
    updateTenantBranding(selectedTenant, { palette: { ...palette } });
    setPaletteDirty(false);
    setFeedback('Cores personalizadas salvas com sucesso.');
    setError('');
  };

  const handleResetPalette = () => {
    if (!selectedTenant) {
      return;
    }
    updateTenantBranding(selectedTenant, { palette: null });
    setPalette(defaultPalette);
    setPaletteDirty(false);
    setFeedback('Paleta restaurada para o padrão da plataforma.');
    setError('');
  };

  const handleApplySuggestion = (suggested: TenantPalette) => {
    setPalette({ ...suggested });
    setPaletteDirty(true);
    setFeedback('Sugestão aplicada. Salve para confirmar as cores.');
    setError('');
  };

  return (
    <ProtectedPage allowedRoles={['admin', 'master']} allowWhenRestricted>
      <section className="space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900">Identidade visual</h1>
          <p className="text-sm text-slate-600">
            Carregue a logomarca do tenant e personalize as cores principais da plataforma. A imagem deve possuir proporção
            horizontal e tamanho máximo de 955 × 218 pixels.
          </p>
        </header>

        <article className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[minmax(0,280px)_1fr] md:items-start">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Selecionar tenant
              <select
                value={selectedTenant}
                onChange={handleTenantChange}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                {tenantOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-3 text-sm text-slate-600">
              <p>
                Formatos aceitos: <strong>PNG</strong>, <strong>JPG</strong>, <strong>SVG</strong> ou <strong>WebP</strong>. Prefira imagens com fundo
                transparente para melhor resultado.
              </p>
              <p>
                Resolução recomendada: <strong>955 × 218 px</strong>. Imagens maiores serão rejeitadas para manter a proporção do cabeçalho.
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-[minmax(0,360px)_1fr] md:items-center">
            <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
              {currentBranding?.logo ? (
                <img
                  src={currentBranding.logo}
                  alt="Pré-visualização da logo"
                  className="max-h-24 w-full object-contain"
                />
              ) : (
                <span className="text-sm text-slate-500">Nenhuma logo cadastrada ainda.</span>
              )}
            </div>

            <div className="space-y-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
                Escolher arquivo
                <input type="file" accept={ACCEPTED_TYPES.join(',')} className="hidden" onChange={handleFileChange} />
              </label>

              {currentBranding?.logoName && (
                <p className="text-xs text-slate-500">
                  Último arquivo: <strong>{currentBranding.logoName}</strong>
                  {currentBranding.logoWidth && currentBranding.logoHeight
                    ? ` (${currentBranding.logoWidth} × ${currentBranding.logoHeight}px)`
                    : ''}
                  {currentBranding.logoUpdatedAt ? ` — atualizado em ${formatDateTime(currentBranding.logoUpdatedAt)}` : ''}
                </p>
              )}

              {currentBranding?.logo && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="text-sm font-medium text-rose-600 transition hover:text-rose-500"
                >
                  Remover logo atual
                </button>
              )}
            </div>
          </div>

          <hr className="border-slate-200" />

          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-slate-900">Personalização de cores</h2>
              <p className="text-sm text-slate-600">
                Ajuste as cores principais da plataforma para alinhar com a identidade visual do cliente. As alterações são aplicadas
                imediatamente após salvar.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {paletteFields.map((field) => (
                <label key={field.key} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <span className="text-sm font-medium text-slate-700">{field.label}</span>
                  <input
                    type="color"
                    value={palette[field.key]}
                    onChange={handlePaletteChange(field.key)}
                    className="h-12 w-full cursor-pointer rounded-lg border border-slate-200 bg-white"
                  />
                  <span className="text-xs text-slate-500">{field.description}</span>
                </label>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">Pré-visualização rápida</p>
              <p className="text-xs text-slate-500">
                Veja como as cores selecionadas se distribuem entre botões, menus e planos de fundo.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                {previewKeys.map(({ key, label }) => (
                  <div key={key} className="flex w-28 flex-col items-center gap-1">
                    <div
                      className="flex h-10 w-full items-center justify-center rounded-lg border border-slate-200 text-xs font-semibold"
                      style={{ backgroundColor: palette[key], color: key === 'primary' ? palette.onPrimary : key === 'secondary' ? palette.onSecondary : getReadableForeground(palette[key]) }}
                    >
                      Aa
                    </div>
                    <span className="text-[11px] text-slate-500">{label}</span>
                    <span className="text-[10px] font-mono text-slate-500">{palette[key]}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSavePalette}
                disabled={!paletteDirty || !selectedTenant}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Salvar cores personalizadas
              </button>
              <button
                type="button"
                onClick={handleResetPalette}
                className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
              >
                Restaurar cores padrão
              </button>
              {paletteDirty && <span className="text-xs text-slate-500">Existem alterações de cores não salvas.</span>}
            </div>

            {suggestions.length > 0 && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-700">Sugestões automáticas</p>
                  <p className="text-xs text-slate-500">
                    Selecionamos combinações com base nas cores predominantes da logo para acelerar a personalização.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {suggestions.map((option, index) => (
                    <button
                      key={`${option.primary}-${index}`}
                      type="button"
                      onClick={() => handleApplySuggestion(option)}
                      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    >
                      <span className="text-sm font-semibold text-slate-700">Combinação {index + 1}</span>
                      <div className="grid grid-cols-5 gap-2">
                        {previewKeys.map(({ key }) => (
                          <div
                            key={key}
                            className="h-10 w-full rounded-lg border border-slate-200"
                            style={{ backgroundColor: option[key] }}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-slate-500">Clique para aplicar esta paleta sugerida.</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {feedback && <p className="text-sm text-emerald-600">{feedback}</p>}
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </article>
      </section>
    </ProtectedPage>
  );
}

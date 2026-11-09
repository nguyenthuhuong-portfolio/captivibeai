import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

/** Browser-safe Supabase client. Only the publishable/anon key belongs here. */
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null

export interface LearningPatternRow {
  id: string
  title: string
  platform: string
  category: string
  pattern: Record<string, unknown>
  quality_score: number | null
  scope: 'global' | 'personal'
}

/** Returns a compact prompt context from approved global and current-user patterns. */
export async function loadLearningContext(platform: string, briefText = ''): Promise<string> {
  if (!supabase) return ''

  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const hasUser = Boolean(sessionData.session?.user?.id)

    // Query global and personal rows separately so a large global library cannot
    // crowd the current user's private patterns out of the retrieval window.
    const globalQuery = supabase
      .from('learning_patterns')
      .select('id,title,platform,category,pattern,quality_score,scope')
      .eq('scope', 'global')
      .eq('status', 'approved')
      .order('quality_score', { ascending: false, nullsFirst: false })
      .limit(18)

    const personalQuery = hasUser
      ? supabase
          .from('learning_patterns')
          .select('id,title,platform,category,pattern,quality_score,scope')
          .eq('scope', 'personal')
          .eq('status', 'approved')
          .order('quality_score', { ascending: false, nullsFirst: false })
          .limit(18)
      : Promise.resolve({ data: [], error: null })

    const [globalResult, personalResult] = await Promise.all([globalQuery, personalQuery])
    const rows = [
      ...(globalResult.error ? [] : globalResult.data ?? []),
      ...(personalResult.error ? [] : personalResult.data ?? []),
    ] as LearningPatternRow[]
    if (!rows.length) return ''

    const brief = briefText.toLocaleLowerCase()
    const categoryTerms: Record<string, string[]> = {
      beauty: ['mỹ phẩm', 'serum', 'kem dưỡng', 'skincare', 'son', 'makeup', 'beauty'],
      fashion: ['quần áo', 'áo', 'váy', 'giày', 'túi', 'thời trang', 'fashion'],
      food: ['đồ ăn', 'món ăn', 'nhà hàng', 'cafe', 'cà phê', 'food'],
      technology: ['điện thoại', 'laptop', 'máy tính', 'tai nghe', 'công nghệ', 'tech'],
      education: ['khóa học', 'học tập', 'ielts', 'giáo dục', 'education'],
      lifestyle: ['lifestyle', 'gia dụng', 'trang trí', 'nội thất'],
    }

    const ranked = rows
      .filter((row) => row.platform === 'all' || row.platform === platform)
      .sort((a, b) => {
        const score = (row: LearningPatternRow) => {
          const exactPlatform = row.platform === platform ? 3 : 0
          const categoryMatch = (categoryTerms[row.category] ?? []).some((term) => brief.includes(term)) ? 2 : 0
          const personalPreference = row.scope === 'personal' ? 1 : 0
          return exactPlatform + categoryMatch + personalPreference + (row.quality_score ?? 0) / 100
        }
        return score(b) - score(a)
      })
      .slice(0, 6)
      .map((row) => ({
        source: row.scope === 'personal' ? 'personal_preference' : 'curated_global',
        platform: row.platform,
        category: row.category,
        title: row.title,
        patterns: row.pattern,
      }))

    return JSON.stringify(ranked).slice(0, 6000)
  } catch {
    // Learning is an enhancement; it must never block ordinary generation.
    return ''
  }
}

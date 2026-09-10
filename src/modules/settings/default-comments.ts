export const DEFAULT_REPORT_COMMENTS = {
  classTeacherComments: 'Mwanafunzi amekuwa na nidhamu njema. Aongeze bidii zaidi ili kuboresha matokeo yake.',
  headTeacherComments: 'Endelea kujituma katika masomo na kudumisha nidhamu nzuri.',
  ctGradeA_en: 'Excellent performance. Keep up the great work and aim even higher.',
  ctGradeB_en: 'Very good performance. Keep working hard to reach the top.',
  ctGradeC_en: 'Good performance. Put in more effort to improve your grades.',
  ctGradeD_en: 'You have potential to do better. Increase effort and focus.',
  ctGradeE_en: 'You need to work much harder and attend classes regularly.',
  ctGradeA_sw: 'Umefanya vizuri sana. Endelea kuongeza bidii zaidi.',
  ctGradeB_sw: 'Umefanya vizuri. Ongeza bidii zaidi ili ufikie kiwango cha juu.',
  ctGradeC_sw: 'Umefanya vizuri kwa kiwango cha wastani. Ongeza bidii zaidi.',
  ctGradeD_sw: 'Una uwezo wa kufanya vizuri zaidi. Ongeza bidii na umakini.',
  ctGradeE_sw: 'Unahitaji kuongeza bidii kubwa zaidi na kuhudhuria vizuri vipindi.',
  htGradeA_en: 'Congratulations on excellent performance. Keep striving for excellence.',
  htGradeB_en: 'You have shown great effort. Keep working hard for better results.',
  htGradeC_en: 'Strive to increase focus and effort to improve your performance.',
  htGradeD_en: 'Work harder in your studies. You can do better with more effort.',
  htGradeE_en: 'It is important to increase effort, discipline and focus in your studies.',
  htGradeA_sw: 'Hongera kwa ufaulu mzuri sana. Endelea kujituma na kudumisha kiwango hiki.',
  htGradeB_sw: 'Umeonyesha juhudi nzuri. Endelea kujituma zaidi ili kufanya vizuri zaidi.',
  htGradeC_sw: 'Jitahidi kuongeza umakini na bidii zaidi ili kuboresha matokeo yako.',
  htGradeD_sw: 'Jitahidi zaidi katika masomo yako. Unaweza kufanya vizuri kwa kuongeza juhudi.',
  htGradeE_sw: 'Ni muhimu kuongeza juhudi, nidhamu na umakini zaidi katika masomo yako.',
}

export type DefaultReportCommentKey = keyof typeof DEFAULT_REPORT_COMMENTS

export function fillDefaultReportComments<T extends Record<string, unknown>>(values: T): T {
  return Object.fromEntries(
    Object.entries({
      ...values,
      ...Object.fromEntries(
        Object.entries(DEFAULT_REPORT_COMMENTS).map(([key, value]) => [
          key,
          values[key] || value,
        ])
      ),
    })
  ) as T
}

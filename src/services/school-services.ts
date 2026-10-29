import {accountSession} from './auth/runtime';
import {parsePostgraduateCourses, parseSemesters, parseUndergraduateCourses,} from './timetable-parser';
import {parseCampusCardBalance} from './campus-card-parser';
import {examEvent, parseExamPage} from './exam-import';
import type {Timetable} from '../shared/timetable';
import type {MessagePreferences} from '../shared/message-preferences';
import type {CampusCardBalance} from '../shared/campus-card';

export async function fetchTimetable(
    preferences: MessagePreferences,
    cached: Timetable | null,
    semesterId?: string,
): Promise<Timetable> {
    if (preferences.identity !== 'student') throw new Error('暂不支持教职员工课表。');
    if (!['undergraduate', 'master', 'doctoral'].includes(preferences.educationLevel))
        throw new Error('请先设置学历阶段。');
    if (semesterId !== undefined && !/^\d{1,12}$/.test(semesterId)) throw new Error('学期无效。');
    if (preferences.educationLevel !== 'undergraduate') {
        const courses = parsePostgraduateCourses(
            await accountSession.servicePage(
                'https://yjsxk.fudan.edu.cn/yjsxkapp/sys/xsxkappfudan/xsxkCourse/loadKbxx.do?_=' +
                Date.now(),
            ),
        );
        return {
            kind: 'postgraduate',
            semesters: [],
            semesterId: '',
            startDate: cached?.startDate ?? null,
            courses,
            updatedAt: new Date().toISOString(),
        };
    }
    const url = 'https://fdjwgl.fudan.edu.cn/student/for-std/course-table';
    const {semesters, defaultId} = parseSemesters(await accountSession.servicePage(url));
    const selected =
        semesters.find((s) => s.id === (semesterId ?? cached?.semesterId ?? defaultId)) ??
        semesters.find((s) => s.id === defaultId)!;
    const courses = parseUndergraduateCourses(
        await accountSession.servicePage(url + '/semester/' + selected.id + '/print-data'),
    );
    return {
        kind: 'undergraduate',
        semesters,
        semesterId: selected.id,
        startDate:
            cached?.semesterId === selected.id
                ? (cached.startDate ?? selected.startDate)
                : selected.startDate,
        courses,
        updatedAt: new Date().toISOString(),
    };
}

export async function fetchExams() {
    const html = await accountSession.servicePage(
        'https://fdjwgl.fudan.edu.cn/student/home',
        true,
        true,
    );
    const exams = parseExamPage(html);
    if (!exams.length) throw new Error('未识别到考试安排，请确认教务系统页面可访问。');
    return exams.map(examEvent);
}

let cachedCard: { owner: string; data: CampusCardBalance } | null = null;

export async function fetchCard(refresh = false) {
    const owner = JSON.stringify(accountSession.state);
    if (
        !refresh &&
        cachedCard?.owner === owner &&
        Date.now() - Date.parse(cachedCard.data.updatedAt) < 300000
    )
        return cachedCard.data;
    const detailUrl = 'https://ecard.fudan.edu.cn/epay/myepay/index';
    const balance = parseCampusCardBalance(await accountSession.servicePage(detailUrl, refresh));
    if (JSON.stringify(accountSession.state) !== owner)
        throw new Error('账号已变更，请重新查询校园卡余额。');
    const data = {balance, updatedAt: new Date().toISOString()};
    cachedCard = {owner, data};
    return data;
}

export function schoolRenderScript(id: number, url: string) {
    return (
        '(' +
        function (id: number, origin: string, path: string) {
            let clicked = false;
            const start = Date.now();
            const collect = () => {
                if (location.origin !== origin) return;
                let html = document.documentElement.outerHTML;
                if (origin === 'https://my.fudan.edu.cn') {
                    const documents = [document];
                    for (const frame of Array.from(document.querySelectorAll('iframe'))) {
                        try {
                            if (frame.contentDocument?.documentElement) documents.push(frame.contentDocument);
                        } catch {
                        }
                    }
                    if (!clicked) {
                        for (const page of documents) {
                            const link = Array.from(page.querySelectorAll('a,button,[role="button"]')).find((e) =>
                                /个人信息|我的信息|个人资料/.test(e.textContent || ''),
                            );
                            if (link) {
                                clicked = true;
                                (link as HTMLElement).click();
                                setTimeout(collect, 500);
                                return;
                            }
                        }
                    }
                    const page = documents.find((page) =>
                        /性别|院系|专业名称|培养层次|学历阶段|入学年份/.test(page.body?.innerText || ''),
                    );
                    if (page) html = page.documentElement.outerHTML;
                    else if (Date.now() - start < 17000) {
                        setTimeout(collect, 500);
                        return;
                    }
                }
                if (origin === 'https://fdjwgl.fudan.edu.cn' && path === '/student/home') {
                    if (!clicked) {
                        const link = Array.from(document.querySelectorAll('a')).find((e) =>
                            (e.textContent || '').includes('考试信息'),
                        );
                        if (link) {
                            clicked = true;
                            link.click();
                        }
                    }
                    let exam = '';
                    for (const frame of Array.from(document.querySelectorAll('iframe'))) {
                        try {
                            if (
                                (frame.getAttribute('src') || '').includes('exam-arrange') &&
                                frame.contentDocument
                            )
                                exam = frame.contentDocument.documentElement.outerHTML;
                        } catch {
                        }
                    }
                    if (exam && /\d{4}[-/.年]\d{1,2}/.test(exam)) html = exam;
                    else if (Date.now() - start < 20000) {
                        setTimeout(collect, 500);
                        return;
                    }
                }
                if (origin === 'https://ecard.fudan.edu.cn' && path.includes('/epay')) {
                    if (
                        !document.querySelector('.custname') ||
                        !document.querySelector('.payway-box-bottom-item > p')
                    ) {
                        if (location.pathname !== '/epay/myepay/index') {
                            location.href = origin + '/epay/myepay/index';
                            return;
                        }
                        if (Date.now() - start < 20000) {
                            setTimeout(collect, 500);
                            return;
                        }
                    }
                }
                (window as any).ReactNativeWebView.postMessage(
                    JSON.stringify({id, url: location.href, html}),
                );
            };
            setTimeout(collect, 1500);
        }.toString() +
        ')(' +
        JSON.stringify(id) +
        ',' +
        JSON.stringify(new URL(url).origin) +
        ',' +
        JSON.stringify(new URL(url).pathname) +
        ');true;'
    );
}

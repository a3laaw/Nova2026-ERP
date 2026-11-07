# ملف CI جاهز لكنه موضعيّاً هنا ⚠️

GitHub **يرفض** أن يُنشئ أي GitHub App ملفاً داخل `.github/workflows/` إذا لم تكن صلاحية
`Workflows` ممنوحة له — وهذا ما حدث عند الدفع (رسالة: *refusing to allow a GitHub App to
create or update workflow without `workflows` permission*).

## التشغيل (30 ثانية، من جهازك فيه gh/push عادي)

```bash
mkdir -p .github/workflows
git mv .ci/github-actions/ci.yml .github/workflows/ci.yml
git commit -m "تفعيل CI" && git push origin HEAD
```

أو انسخ الملف يدويّاً ثم اعمل commit/push بحسابك (الحساب الشخصي يملك الصلاحية عادةً).

## أو أعطِ التطبيق الصلاحية
Settings → GitHub Apps → هذا التطبيق → Repository permissions → **Workflows: Read and write**،
ثم أعد الدفع من الوكيل.

## ماذا يفعّل هذا الملف؟
| وظيفة | ما تفحصه |
|---|---|
| `quality` | `tsc --noEmit` · `npm run check:relations` · `npm run docs:guide:check` · صلاحية JSON لـ `firebase.json`/`firestore.indexes.json` · `npm run build` |
| `firestore-emulator` | إقلاع إيميليتر Firestore/Auth = **أول فحص آلي لصياغة `firestore.rules`** |

> لماذا يهم في النقل: هذه البوابات كانت تؤدّيها منصة التطوير ضمنيّاً. بدونها لا يوجد أي
> رادع يمنع كوداً مولّداً بالذكاء الاصطناعي من كسر توازن القيد أو ترك مجموعة غير موثّقة.

import { Diary } from "../models/Diary";
import { TemplatePage } from "../models/DiaryTemplate";

/** Return one page from the diary's personal JSON copy */
export async function getDiaryPage(diaryId: any, pageNo: any) {
  const diaryRecord = await Diary.findByPk(diaryId);
  if (!diaryRecord) throw new Error("Sold diary not found");

  const diaryData = (diaryRecord as any).diaryData;
  if (!diaryData?.pages) throw new Error("Diary data not initialised");

  const page = diaryData.pages.find((p: TemplatePage) => p.page_no === pageNo);
  if (!page) throw new Error(`Page "${pageNo}" not found`);

  return page;
}

export interface SaveAnswerParams {
  diaryId?: any;
  pageNo: any;
  questionNo: string;
  answer: string;
}

/**
 * Find the field matching question_no inside the page and update its answer.
 * Works for both flat fields[] and nested sections[].fields[].
 */
export async function saveAnswer(params: SaveAnswerParams) {
  const { diaryId, pageNo, questionNo, answer } = params;

  const diaryRecord = await Diary.findByPk(diaryId);
  if (!diaryRecord) throw new Error("Sold diary not found");

  const diaryData = (diaryRecord as any).diaryData;
  if (!diaryData?.pages) throw new Error("Diary data not initialised");

  const page = diaryData.pages.find((p: any) => p.page_no === pageNo);
  if (!page) throw new Error(`Page "${pageNo}" not found`);

  let updated = false;

  // Search flat fields
  if (page.fields) {
    for (const f of page.fields) {
      if (f.question_no === questionNo) {
        f.answer = answer;
        updated = true;
        break;
      }
    }
  }

  // Search inside sections
  if (!updated && page.sections) {
    outer: for (const sec of page.sections) {
      if (sec.question_no === questionNo) {
        sec.answer = answer;
        updated = true;
        break;
      }

      if (sec.fields) {
        for (const f of sec.fields) {
          if (f.question_no === questionNo) {
            f.answer = answer;
            updated = true;
            break outer;
          }
        }
      }
    }
  }

  if (!updated) {
    throw new Error(`Question "${questionNo}" not found on page "${pageNo}"`);
  }
  console.log(diaryData);
  
  // Persist JSONB update
  diaryRecord.set("diaryData", diaryData);
  await diaryRecord.save();

  return page;
}

/** Submit a full page at once */
export async function submitPage(
  diaryId: any,
  pageNo: any,
  answers: Array<{ question_no: string; answer: any }>
) {
  const diaryRecord = await Diary.findByPk(diaryId);
  if (!diaryRecord) throw new Error("Sold diary not found");

  const diaryData = (diaryRecord as any).diaryData;
  if (!diaryData?.pages) throw new Error("Diary data not initialised");

  const page = diaryData.pages.find((p: any) => p.page_no == pageNo);
  if (!page) throw new Error(`Page "${pageNo}" not found`);

  for (const ans of answers) {
    let found = false;

    if (page.fields) {
      for (const f of page.fields) {
        if (f.question_no === ans.question_no) {
          f.answer = ans.answer;
          found = true;
          break;
        }
      }
    }

    if (!found && page.sections) {
      outer: for (const sec of page.sections) {
        if (sec.question_no === ans.question_no) {
          sec.answer = ans.answer;
          found = true;
          break;
        }

        if (sec.fields) {
          for (const f of sec.fields) {
            if (f.question_no === ans.question_no) {
              f.answer = ans.answer;
              found = true;
              break outer;
            }
          }
        }
      }
    }

    if (!found) {
      throw new Error(
        `Question "${ans.question_no}" not found on page "${pageNo}"`
      );
    }
  }

  // IMPORTANT: tell sequelize JSON changed
  diaryRecord.changed("diaryData", true);

  await diaryRecord.save();

  return page;
}
export async function getFilledDiaryAnswers(diaryId: any) {
  const diaryRecord = await Diary.findByPk(diaryId);
  if (!diaryRecord) throw new Error("Diary not found");

  const diaryData = (diaryRecord as any).diaryData;
  if (!diaryData?.pages) throw new Error("Diary data not initialised");

  const answers: any[] = [];

  for (const page of diaryData.pages) {

    // flat fields
    if (page.fields) {
      for (const field of page.fields) {
        if (
          field.question_no &&
          field.answer !== undefined &&
          field.answer !== null &&
          field.answer !== ""
        ) {
          answers.push({
            question_no: field.question_no,
            question: field.field_name,
            answer: field.answer
          });
        }
      }
    }

    // sections
    if (page.sections) {
      for (const section of page.sections) {

        if (
          section.question_no &&
          section.answer !== undefined &&
          section.answer !== null &&
          section.answer !== ""
        ) {
          answers.push({
            question_no: section.question_no,
            question: section.question,
            answer: section.answer
          });
        }

        if (section.fields) {
          for (const field of section.fields) {
            if (
              field.question_no &&
              field.answer !== undefined &&
              field.answer !== null &&
              field.answer !== ""
            ) {
              answers.push({
                question_no: field.question_no,
                question: field.question,
                answer: field.answer
              });
            }
          }
        }
      }
    }
  }

  return { answers };
}
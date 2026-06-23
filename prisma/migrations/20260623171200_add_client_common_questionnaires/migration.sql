-- CreateTable
CREATE TABLE "_ClientCommonQuestionnaires" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ClientCommonQuestionnaires_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ClientCommonQuestionnaires_B_index" ON "_ClientCommonQuestionnaires"("B");

-- AddForeignKey
ALTER TABLE "_ClientCommonQuestionnaires" ADD CONSTRAINT "_ClientCommonQuestionnaires_A_fkey" FOREIGN KEY ("A") REFERENCES "ClientLE"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClientCommonQuestionnaires" ADD CONSTRAINT "_ClientCommonQuestionnaires_B_fkey" FOREIGN KEY ("B") REFERENCES "Questionnaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

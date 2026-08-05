-- AlterTable
ALTER TABLE "books" ADD COLUMN "coverUrl" TEXT;
ALTER TABLE "books" ADD COLUMN "isbn" TEXT;
ALTER TABLE "books" ADD COLUMN "publishedYear" INTEGER;
ALTER TABLE "books" ADD COLUMN "publisher" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "books_isbn_key" ON "books"("isbn");


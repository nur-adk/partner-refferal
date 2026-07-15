import "dotenv/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../app/generated/prisma/client";

// Same libSQL adapter as the app: local ./dev.db by default, or Turso when the
// TURSO_* env vars are set.
const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const prisma = new PrismaClient({ adapter });

// Outreach team decision-maker profiles. Only the signals that power the
// warm-connection check are stored: education (schools) and career history
// (companies). Sourced from their LinkedIn/Sales Navigator profiles.
const decisionMakers = [
  {
    name: "Hugh",
    education: [
      { school: "University of Chicago Booth School of Business", degree: "MBA", years: "2012–2014" },
      { school: "University College Dublin", degree: "MSc Finance & MSc Management", years: "2006–2009" },
      { school: "Johannes Kepler Universität Linz", degree: "International Law & German Studies", years: "2004–2005" },
      { school: "Trinity College Dublin", degree: "LLB Law & German", years: "2001–2006" },
    ],
    pastEmployers: [
      { company: "K.H.", title: "Partner", years: "2021–Present" },
      { company: "Credit Suisse", title: "Vice President", years: "2014–2020" },
      { company: "BNY Mellon", title: "Analyst", years: "2009–2012" },
    ],
  },
  {
    name: "Ayema",
    education: [
      { school: "Lahore Medical & Dental College", degree: "BDS, Dentistry", years: "2014–2018" },
      { school: "University of the Punjab", degree: "BS" },
    ],
    pastEmployers: [
      { company: "Klimt and Design", title: "COO", years: "2025–Present" },
      { company: "Primer", title: "COO", years: "2025–Present" },
      { company: "Crowdbotics", title: "Strategic Partnerships Development Manager", years: "2023–2025" },
      { company: "Better Learn", title: "Founder", years: "2021–2024" },
      { company: "SudoStudy", title: "Strategic Partnerships & Business Operations Lead", years: "2021–2022" },
    ],
  },
  {
    name: "Sadie",
    education: [
      { school: "Indiana State University", degree: "B.S. Elementary Education & Teaching", years: "2011–2014" },
    ],
    pastEmployers: [
      { company: "Klimt and Design", title: "Creative Director", years: "2025–Present" },
      { company: "Goodway Group", title: "Head of Production", years: "2022–2025" },
      { company: "Vivint", title: "Senior Creative Manager / Production", years: "2020–2022" },
      { company: "Vivint Gives Back", title: "Program/Project Manager", years: "2018–2020" },
      { company: "East Midvale Elementary School", title: "Elementary School Teacher", years: "2015–2018" },
      { company: "Forest Dale Elementary", title: "Elementary School Teacher", years: "2014–2015" },
    ],
  },
  {
    name: "Michelle",
    education: [
      { school: "UCLA", degree: "Bachelor's, Design & Media Arts", years: "2011–2014" },
    ],
    pastEmployers: [
      { company: "Primer", title: "CEO", years: "2025–Present" },
      { company: "Klimt and Design", title: "Co-Founder & Head of Design", years: "2021–Present" },
      { company: "B12", title: "Web Designer", years: "2019–2021" },
      { company: "Rhiz", title: "Product Designer", years: "2019–2020" },
      { company: "Reykjavik Museum of Photography", title: "Museum Intern", years: "2018" },
      { company: "Devin Alexander, Inc.", title: "Graphic & Web Designer / Photographer", years: "2013–2017" },
    ],
  },
];

async function main() {
  for (const dm of decisionMakers) {
    const data = {
      education: JSON.stringify(dm.education),
      pastEmployers: JSON.stringify(dm.pastEmployers),
    };
    const existing = await prisma.decisionMaker.findFirst({ where: { name: dm.name } });
    if (existing) {
      await prisma.decisionMaker.update({ where: { id: existing.id }, data });
    } else {
      await prisma.decisionMaker.create({ data: { name: dm.name, ...data } });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

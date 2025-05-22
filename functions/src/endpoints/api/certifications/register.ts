// import prismaInstance from '../../../services/prisma/index'; // Adjust the import path as necessary

const handler = async (req: any, res: any) => {
  try {
    const { title, description, questions } = req.body;

    if (!title || !description || !questions) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // const exam = await prismaInstance.exams.create({});
    const exam = {};

    res.status(201).json({ message: 'Exam created successfully', exam });
  } catch (error) {
    console.error('Error creating exam:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default handler;

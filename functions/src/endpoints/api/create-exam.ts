import prismaInstance from '../../services/prisma/index'; // Adjust the import path as necessary

const handler = async (req: any, res: any) => {
  try {
    const { title, description, questions } = req.body;

    if (!title || !description || !questions) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const exam = await prismaInstance.exams.create({
      data: {
        user_id: 1, // Placeholder user ID
        cert_id: 1, // Placeholder certification ID
        quiz_question_id_list: JSON.stringify([]), // Default empty list of quiz questions
        score: 0, // Default score
        started_at: new Date(), // Current timestamp
        submitted_at: null, // Default to null for unsubmitted exams
      },
    });

    res.status(201).json({ message: 'Exam created successfully', exam });
  } catch (error) {
    console.error('Error creating exam:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default handler;

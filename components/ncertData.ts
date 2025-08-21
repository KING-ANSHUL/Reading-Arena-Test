interface Chapter { title: string; content?: string }

interface SubjectData {
  bookName: string;
  chapters: Chapter[];
}

interface ClassData {
  [subject: string]: SubjectData;
}

interface NcertBooks {
  [classNumber: string]: ClassData;
}

export const NCERT_BOOKS: NcertBooks = {
  '1': {
    'English': {
      bookName: 'Marigold',
      chapters: [
        { title: 'A Happy Child', content: 'My house is red, a little house. A happy child am I. I laugh and play the whole day long. I hardly ever cry. I have a tree, a green, green tree. To shade me from the sun.' },
        { title: 'Three Little Pigs', content: 'Once upon a time there were three little pigs. Sonu, Monu, and Gonu. Sonu lived in a house of straw. Monu lived in a house of sticks. Gonu lived in a house of bricks.' },
        { title: 'After a Bath', content: 'After my bath, I try, try, try to wipe myself till I am dry, dry, dry. Hands to wipe and fingers and toes. And two wet legs and a shiny nose.' },
        { title: 'The Bubble, the Straw, and the Shoe', content: 'Once upon a time there lived a Bubble, a Straw and a Shoe. One day they went into the forest. They came to a river. They did not know how to cross it.' },
        { title: 'One Little Kitten', content: 'One little kitten, two big cats. Three baby butterflies, four big rats. Five fat fishes, six sad seals. Seven silly seagulls, eight happy eels.' },
      ],
    },
    'Hindi': {
        bookName: 'Rimjhim',
        chapters: [
            { title: 'झूला', content: 'अम्मा आज लगा दे झूला। इस झूले पर मैं झूलूँगा। इस पर चढ़कर, ऊपर बढ़कर, आसमान को मैं छू लूँगा। झूला झूल रही है डाली। झूल रहा है पत्ता-पत्ता।' },
            { title: 'आम की कहानी', content: 'एक लड़की ने एक आम का पेड़ देखा। उस पर एक पका हुआ आम लगा था। उसके मुँह में पानी आ गया। उसने अपने भाई को बुलाया।' },
            { title: 'पत्ते ही पत्ते', content: 'दीदी बोलीं, मैं पाँच तक गिनूँगी। गिनती शुरू करने से पहले तुम लोग गोला बनाकर बैठ जाओ। एक, दो, तीन, चार, पाँच!'},
            { title: 'पकौड़ी', content: 'दौड़ी दौड़ी आई पकौड़ी। छुन छुन छुन छुन तेल में नाची। प्लेट में आ शरमाई पकौड़ी। दौड़ी दौड़ी आई पकौड़ी।' },
        ]
    },
    'Science': {
        bookName: 'Looking Around',
        chapters: [
            { title: 'Our Body', content: 'We have a wonderful body. It has many parts. Each part has a name. We have two eyes to see. We have one nose to smell.'},
            { title: 'Plants Around Us', content: 'We see many plants around us. Some are big and some are small. Trees are big plants. Shrubs are small plants.'},
            { title: 'Animals Around Us', content: 'We see many animals around us. Some animals are big, like elephants. Some animals are small, like cats.'}
        ]
    }
  },
  '2': {
     'English': {
        bookName: 'Marigold - 2',
        chapters: [
            { title: 'First Day at School', content: 'I wonder if my drawing will be as good as theirs. I wonder if they will like me or just be full of stares. I wonder if my teacher will look like Mom or Gran.' },
            { title: 'I am Lucky', content: 'If I were a butterfly, I would be thankful for my wings. If I were a myna in a tree, I would be thankful that I could sing. So I just think I am lucky to be me.' },
            { title: 'I Want', content: 'Little Monkey wants to be big and strong. A wise woman gives him a magic wand. He sees a giraffe and wants a long neck. He sees an elephant and wants a big trunk.' },
            { title: 'Storm in the Garden', content: 'Sunu-sunu the snail was visiting his friends, the ants. Suddenly, a great white light crashed through the clouds. Sunu-sunu pulled in his head and pulled in his tail. He sat very still.' },
        ],
     },
    'Hindi': {
        bookName: 'Rimjhim - 2',
        chapters: [
            { title: 'ऊँट चला', content: 'ऊँट चला भई ऊँट चला। हिलता डुलता ऊँट चला। इतना ऊँचा ऊँट चला। ऊँट चला भई ऊँट चला।' },
            { title: 'भालू ने खेली फुटबॉल', content: 'सर्दियों का मौसम था। सुबह का वक्त। चारों ओर कोहरा ही कोहरा। एक शेर का बच्चा सिमटकर गोल-मटोल बना जामुन के पेड़ के नीचे सोया हुआ था।' },
        ]
    },
     'Science': {
        bookName: 'Looking Around - 2',
        chapters: [
             { title: 'Water O Water', content: 'I will wash my face with water, said Munna to his Nani. We all quench our thirst with water. We are all alive because of water.' },
             { title: 'Our First School', content: 'Our home is our first school. The members of our family are our family. We learn so many things from our family.' },
        ]
     }
  },
  '3': {
    'English': {
        bookName: 'Marigold - 3',
        chapters: [
            { title: 'Good Morning', content: 'Good morning, sky. Good morning, sun. Good morning, little winds that run. Good morning, birds. Good morning, trees. And creeping grass, and brownie bees.' },
            { title: 'The Magic Garden', content: 'The magic garden was in a school playground. It was very pretty. Sunflowers and roses stood high against the wall. There were also marigolds, poppies and pansies.' },
            { title: 'Nina and the Baby Sparrows', content: 'There was great joy in Nina’s house. Nina’s aunt was getting married. Nina, her father, mother and little brother were all going to Delhi for a wedding.' },
        ],
    },
    'Hindi': {
        bookName: 'Rimjhim - 3',
        chapters: [
            { title: 'कक्कू', content: 'नाम है उसका कक्कू। कक्कू माने कोयल होता। लेकिन यह तो दिन भर रोता। इसीलिए हम इसे चिढ़ाते। कहते इसको सक्कू। नाम है उसका कक्कू।' },
            { title: 'मन करता है', content: 'मन करता है, सूरज बनकर आसमान में दौड़ लगाऊँ। मन करता है, चंदा बनकर सब तारों पर अकड़ दिखाऊँ। मन करता है, तितली बनकर दूर-दूर उड़ता जाऊँ।' },
        ]
    },
    'Science': {
        bookName: 'Looking Around - 3',
        chapters: [
            { title: 'Poonam\'s Day Out', content: '“Maa, please let me go to school today. I have been at home for the past two days.” Poonam said. “But you still have fever.” said her mother.'},
            { title: 'The Plant Fairy', content: 'Last Sunday we went to a garden in the neighbourhood. We played Hide and Seek and Antakshari. We had a lot of fun.'},
        ]
    }
  },
  '4': {
    'English': {
        bookName: 'Marigold - 4',
        chapters: [
            { title: 'Wake Up!', content: 'Wake up! Wake up! It’s a lovely day. Oh! please get up and come and play. The birds are singing in the trees, and you can hear the buzzing bees.' },
            { title: 'Noses', content: 'I looked in the mirror and looked at my nose. It’s the funniest thing, the way it grows. Stuck right out where all of it shows with two little holes where the breathing goes.' },
        ],
    },
    'Hindi': {
        bookName: 'Rimjhim - 4',
        chapters: [
            { title: 'मन के भोले-भाले बादल', content: 'झब्बर-झब्बर बालों वाले। गुब्बारे-से गालों वाले। लगे दौड़ने आसमान में। झूम-झूमकर काले बादल। कुछ जोकर-से तोंद फुलाए।' },
            { title: 'जैसा सवाल, वैसा जवाब', content: 'बादशाह अकबर अपने मंत्री बीरबल को बहुत पसंद करता था। बीरबल की बुद्धि के आगे बड़े-बड़ों की भी कुछ नहीं चल पाती थी।' },
        ]
    },
    'Science': {
        bookName: 'Looking Around - 4',
        chapters: [
            { title: 'Going to School', content: 'Let us meet some children and see how they reach school. In some parts of Assam, there is a lot of water. Children cross the water using a bamboo bridge.' },
            { title: 'A Day with Nandu', content: 'Nandu woke up and opened his eyes. For a few seconds he was not sure where he was. It seemed to him that he was surrounded by a forest of big grey tree trunks.' },
        ]
    }
  }
};
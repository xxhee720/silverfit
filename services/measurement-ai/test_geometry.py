import unittest
from geometry import visible_dimensions
class GeometryTest(unittest.TestCase):
    def test_projection(self):
        self.assertEqual(visible_dimensions([100,100,300,400],800,600,2,1000), (400,600))
    def test_reject(self):
        for box, depth, focal in [([100,100,50,400],2,1000),([0,0,900,400],2,1000),([0,0,200,400],2,0),([0,0,200,400],float('nan'),1000)]:
            with self.assertRaises(ValueError): visible_dimensions(box,800,600,depth,focal)
if __name__ == '__main__': unittest.main()
